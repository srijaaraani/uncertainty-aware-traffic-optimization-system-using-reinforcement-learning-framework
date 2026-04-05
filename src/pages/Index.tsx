/**
 * Traffic Signal Simulation - Main Page
 * 
 * This is the main entry point for the traffic simulation UI shell.
 * 
 * IMPORTANT: This application is ONLY a visualization and interaction shell.
 * All core logic, algorithms, probabilistic modeling, reward design,
 * and multi-agent coordination will be implemented separately and connected later.
 */

import React, { useCallback, useState, useRef } from 'react';
import { useSimulation } from '@/hooks/useSimulation';
import { useVehicles } from '@/hooks/useVehicles';
import { IntersectionView } from '@/components/simulation/IntersectionView';
import { ControlPanel } from '@/components/controls/ControlPanel';
import { MetricsDisplay } from '@/components/controls/MetricsDisplay';
import { Direction } from '@/types/simulation';
import { SensorNoiseConfig, DEFAULT_NOISE_CONFIG } from '@/corelogic/probabilisticSensorModel';
import { trafficSignalAgent, AgentObservation, SignalPhase, AgentAction } from '@/corelogic/agent';
import { signalController } from '@/corelogic/signalController';
import { dqnAgent, QValueDecision } from '@/corelogic/dqnAgent';
import { QValueDisplay } from '@/components/controls/QValueDisplay';
import { Settings, X } from 'lucide-react';

export default function Index() {
  const {
    isRunning,
    signalState,
    vehicleCounts,
    config,
    lastSignalChangeTime,
    start,
    pause,
    reset,
    changeSignal,
    setSpawnRate,
    setLaneConfig,
    setTrafficRandomness,
    incrementVehicleCount,
    resetVehicleCounts,
    applyAgentDecision,
    computeAndLogReward,
    agentEnabled,
    enableAgent,
    setAgentDecisionIntervalMs,
    dqnMode,
    setDqnModeEnabled,
    dqnMetrics,
    trainDQNAgent,
    lastObservationRef,
    hasSimulationBeenStarted,
    simulationSessionId,
  } = useSimulation();

  // Sensor noise configuration state
  const [noiseConfig, setNoiseConfig] = useState<SensorNoiseConfig>(DEFAULT_NOISE_CONFIG);
  const [noiseEnabled, setNoiseEnabled] = useState(true);

  // Determine which noise config to use based on noise enabled state
  const effectiveNoiseConfig: SensorNoiseConfig = noiseEnabled
    ? noiseConfig
    : {
      queueLengthNoise: 0,
      avgWaitingTimeNoise: 0,
      avgSpeedNoise: 0,
    };

  // Agent observation state (noisy observations from sensor model)
  const [lastAgentObservation, setLastAgentObservation] = useState<AgentObservation | null>(null);

  // Q-value decision state for display
  const [lastQValueDecision, setLastQValueDecision] = useState<QValueDecision | null>(null);
  const [qValueHistory, setQValueHistory] = useState<number[][]>([]);

  // Track elapsed time for current signal phase (for display)
  const [elapsedTimeSeconds, setElapsedTimeSeconds] = useState(0);

  // Mobile control panel overlay state
  const [isMobileControlOpen, setIsMobileControlOpen] = useState(false);

  const handleVehicleSpawned = useCallback((direction: Direction) => {
    incrementVehicleCount(direction);
  }, [incrementVehicleCount]);

  const { vehicles, resetVehicles } = useVehicles({
    config,
    signalState,
    isRunning,
    onVehicleSpawned: handleVehicleSpawned,
  });

  const handleReset = useCallback(() => {
    reset();
    resetVehicles();
    resetVehicleCounts();
  }, [reset, resetVehicles, resetVehicleCounts]);

  /**
   * Handles automatic agent decision-making based on noisy observations
   * 
   * The decision flow:
   * 1. If MAX_GREEN_TIME (25s) exceeded without a switch: force switch to prevent starvation
   * 2. If in decision window (10-25s): agent observes noisy metrics and decides whether to switch or stay
   * 3. If before 10s: no switching allowed (minimum green time protection)
   * 
   * Decision Window (10-25s):
   * - Agent continuously observes noisy metrics
   * - Agent can propose SWITCHING to other direction OR KEEPING current phase
   * - Switch only occurs if agent explicitly chooses to switch AND controller allows it
   * - This allows truly conditional (not forced) switching within the decision window
   * 
   * DQN Mode:
   * - Uses DQN agent instead of rule-based agent
   * - Stores experiences and trains on replay buffer
   * - Learns optimal policy over time
   */
  const makeAgentDecision = useCallback(() => {
    // Check if forced switch due to MAX_GREEN_TIME exceeded without a decision window switch
    if (signalController.mustSwitchSignal()) {
      const currentPhase = signalController.getCurrentPhase();
      const forcedPhase: SignalPhase = currentPhase === 'NS' ? 'EW' : 'NS';
      console.log('[SignalController] FORCED switch due to MAX_GREEN_TIME (15s) exceeded without adaptive switch');
      const switchApplied = applyAgentDecision(forcedPhase, true);
      // Log reward when switch is applied
      if (switchApplied) {
        computeAndLogReward(vehicles, true);
      }
      return;
    }

    // Check if we're in the decision window (10-25 seconds)
    if (!signalController.isInDecisionWindow()) {
      // Outside decision window - no agent decisions allowed
      return;
    }

    // In decision window: agent proposes action based on observations
    if (!lastAgentObservation) {
      return;
    }

    let agentAction: AgentAction;

    // Select action based on agent mode (rule-based or DQN)
    if (dqnMode) {
      // DQN agent selects action using epsilon-greedy policy
      agentAction = dqnAgent.selectAction(lastAgentObservation);

      // Capture Q-value decision for display
      const decision = dqnAgent.getLastDecision();
      if (decision) {
        setLastQValueDecision(decision);
        setQValueHistory(dqnAgent.getQValueHistory());
      }
    } else {
      // Rule-based agent observes ONLY noisy metrics and makes decision
      agentAction = trafficSignalAgent.decideAction(lastAgentObservation);
    }

    // Store previous observation for DQN training
    const previousObservation = lastObservationRef.current;
    lastObservationRef.current = lastAgentObservation;

    // Apply the agent's decision (signal controller will only allow if still in window)
    const switchApplied = applyAgentDecision(agentAction);

    // Log reward when decision is applied (whether switch or keep)
    const wasSwitched = switchApplied && agentAction !== 'KEEP';
    const rewardComponents = computeAndLogReward(vehicles, wasSwitched);

    // Train DQN agent if in DQN mode and we have a previous observation
    if (dqnMode && previousObservation && lastAgentObservation) {
      trainDQNAgent(
        previousObservation,
        agentAction,
        rewardComponents.totalReward,
        lastAgentObservation
      );
    }
  }, [lastAgentObservation, applyAgentDecision, computeAndLogReward, vehicles, dqnMode, trainDQNAgent]);

  // Use refs to avoid recreating interval when callbacks change
  const observationRef = useRef(lastAgentObservation);
  const decisionRef = useRef(applyAgentDecision);
  const makeDecisionRef = useRef(makeAgentDecision);

  // Update refs whenever dependencies change
  React.useEffect(() => {
    observationRef.current = lastAgentObservation;
    decisionRef.current = applyAgentDecision;
    makeDecisionRef.current = makeAgentDecision;
  }, [lastAgentObservation, applyAgentDecision, makeAgentDecision]);

  // Execute agent decisions periodically when agent is enabled
  React.useEffect(() => {
    if (!agentEnabled || !isRunning) return;

    const interval = setInterval(() => {
      makeDecisionRef.current();
    }, 1000); // Agent makes decision every 1 second

    return () => clearInterval(interval);
  }, [agentEnabled, isRunning]);

  // Update elapsed time display every 100ms
  React.useEffect(() => {
    if (!isRunning || !agentEnabled) return;

    const timer = setInterval(() => {
      const elapsed = signalController.getTimeSinceLastChange();
      setElapsedTimeSeconds(Math.round(elapsed * 10) / 10); // Round to 1 decimal
    }, 100);

    return () => clearInterval(timer);
  }, [isRunning, agentEnabled]);

  return (
    <div className="min-h-screen w-screen bg-gradient-to-br from-background to-muted flex flex-col p-4 overflow-x-hidden">
      {/* Main Content - Responsive Dashboard */}
      <main className="flex-1 flex flex-col gap-4">
        {/* Simulation Panel (full width rectangle) */}
        <section className="relative bg-card rounded-xl border border-border shadow-sm p-4 flex justify-center items-center">
          <div className="w-full">
            <div className="relative w-full h-[70vh] sm:h-[75vh] md:h-[80vh] lg:h-[85vh]">
              <IntersectionView
                vehicles={vehicles}
                signalState={signalState}
                config={config}
                elapsedTimeSeconds={elapsedTimeSeconds}
                agentEnabled={agentEnabled}
              />
            </div>
          </div>
        </section>

        {/* Metrics + Control panels side-by-side */}
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Metrics Panel */}
          <div className="min-h-[220px] overflow-auto custom-scrollbar bg-card rounded-xl border border-border shadow-sm p-4 flex flex-col">
            <div className="flex-1 overflow-auto custom-scrollbar">
              <MetricsDisplay
                vehicles={vehicles}
                config={config}
                lastSignalChangeTime={lastSignalChangeTime}
                isRunning={isRunning}
                signalState={signalState}
                noiseConfig={effectiveNoiseConfig}
                agentEnabled={agentEnabled}
                onNoisyObservationUpdate={setLastAgentObservation}
                hasSimulationBeenStarted={hasSimulationBeenStarted}
                simulationSessionId={simulationSessionId}
              />
            </div>
          </div>

          {/* Control Panel */}
          <div className="overflow-auto custom-scrollbar bg-card rounded-xl border border-border shadow-sm p-4">
            <div className="max-w-3xl mx-auto w-full">
              <header className="mb-4">
                <h1 className="text-xl font-bold text-foreground">
                  Traffic Signal Control
                </h1>
                <p className="text-xs text-muted-foreground mt-1">
                  Uncertainty-Aware DQN Simulation Dashboard
                </p>
              </header>

              {dqnMode && agentEnabled && (
                <div className="mb-4">
                  <QValueDisplay
                    decision={lastQValueDecision}
                    qValueHistory={qValueHistory}
                  />
                </div>
              )}

              <ControlPanel
                isRunning={isRunning}
                signalState={signalState}
                vehicleCounts={vehicleCounts}
                config={config}
                noiseConfig={noiseConfig}
                noiseEnabled={noiseEnabled}
                agentEnabled={agentEnabled}
                dqnMode={dqnMode}
                dqnMetrics={dqnMetrics}
                onStart={start}
                onPause={pause}
                onReset={handleReset}
                onSignalChange={changeSignal}
                onTrafficRandomnessChange={setTrafficRandomness}
                onLaneConfigChange={setLaneConfig}
                onNoiseConfigChange={setNoiseConfig}
                onNoiseEnabledChange={setNoiseEnabled}
                onAgentEnabledChange={enableAgent}
                onDqnModeChange={setDqnModeEnabled}
              />

              <footer className="mt-6 text-center pb-2 opacity-60">
                <p className="text-[10px] text-muted-foreground">
                  Adaptive Traffic Control System • Final Project
                </p>
              </footer>
            </div>
          </div>
        </section>
      </main>

      {/* Mobile control panel overlay (covers simulation area) */}
      {isMobileControlOpen && (
        <div className="xl:hidden fixed inset-0 z-30 bg-background/80 backdrop-blur-sm">
          <div className="h-full w-full flex flex-col">
            <div className="flex justify-end p-3">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full bg-black/70 text-white p-2 shadow-md hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
                onClick={() => setIsMobileControlOpen(false)}
                aria-label="Close control panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto px-3 pb-4">
              <div className="max-w-3xl mx-auto">
                <ControlPanel
                  isRunning={isRunning}
                  signalState={signalState}
                  vehicleCounts={vehicleCounts}
                  config={config}
                  noiseConfig={noiseConfig}
                  noiseEnabled={noiseEnabled}
                  agentEnabled={agentEnabled}
                  dqnMode={dqnMode}
                  dqnMetrics={dqnMetrics}
                  onStart={start}
                  onPause={pause}
                  onReset={handleReset}
                  onSignalChange={changeSignal}
                  onTrafficRandomnessChange={setTrafficRandomness}
                  onLaneConfigChange={setLaneConfig}
                  onNoiseConfigChange={setNoiseConfig}
                  onNoiseEnabledChange={setNoiseEnabled}
                  onAgentEnabledChange={enableAgent}
                  onDqnModeChange={setDqnModeEnabled}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}