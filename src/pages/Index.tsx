/**
 * Traffic Signal Simulation - Main Page
 * 
 * This is the main entry point for the traffic simulation UI shell.
 * 
 * IMPORTANT: This application is ONLY a visualization and interaction shell.
 * All core logic, algorithms, probabilistic modeling, reward design,
 * and multi-agent coordination will be implemented separately and connected later.
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useSimulation } from '@/hooks/useSimulation';
import { useVehicles } from '@/hooks/useVehicles';
import { IntersectionView } from '@/components/simulation/IntersectionView';
import { ControlPanel } from '@/components/controls/ControlPanel';
import { MetricsDisplay } from '@/components/controls/MetricsDisplay';
import { ComparisonDashboard } from '@/components/controls/ComparisonDashboard';
import { Direction } from '@/types/simulation';
import { TrainingNoiseConfig, DEFAULT_TRAINING_NOISE_CONFIG, applyTrainingNoise } from '@/corelogic/probabilisticSensorModel';
import { trafficSignalAgent, AgentObservation, SignalPhase, AgentAction } from '@/corelogic/agent';
import { signalController } from '@/corelogic/signalController';
import { dqnAgent, QValueDecision } from '@/corelogic/dqnAgent';
import { QValueDisplay } from '@/components/controls/QValueDisplay';
import { getEnvironmentState } from '@/utils/environmentState';
import { computeReward } from '@/corelogic/rewardFunction';
import {
  logTimestep,
  startSession,
  resolveMode,
  clearAll as clearComparisonData,
} from '@/utils/comparisonLogger';
import { Settings, X, Play, Pause, RotateCcw, ArrowLeftRight, Bot, Filter, Activity, Eye } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

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
    setEnvironmentNoise,
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
    virtualBaseState,
  } = useSimulation();

  // Training (Observation) noise configuration state
  const [trainingNoiseConfig, setTrainingNoiseConfig] = useState<TrainingNoiseConfig>(DEFAULT_TRAINING_NOISE_CONFIG);
  const [trainingNoiseEnabled, setTrainingNoiseEnabled] = useState(true);

  // Comparison dashboard: version counter triggers re-render when new data arrives
  const [dataVersion, setDataVersion] = useState(0);

  // Determine which noise config to use based on training noise enabled state
  // This is used for generating the observation for the agent
  const effectiveTrainingNoiseConfig: TrainingNoiseConfig = trainingNoiseEnabled
    ? trainingNoiseConfig
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

  // Simulation Filter Overlay state
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Dynamic virtual dimensions based on aspect ratio to ensure edge-to-edge spawning.
  // We initialize with a function to capture the correct dimensions on the very first render.
  const [virtualDimensions, setVirtualDimensions] = useState(() => {
    if (typeof window !== 'undefined') {
      const ratio = window.innerWidth / window.innerHeight;
      return {
        width: Math.max(600, ratio * 600),
        height: 600
      };
    }
    return { width: 600, height: 600 };
  });

  React.useEffect(() => {
    const updateDimensions = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const ratio = width / height;
      
      // We keep virtual height at 600 units and scale width proportionally
      setVirtualDimensions({
        width: Math.max(600, ratio * 600),
        height: 600
      });
    };

    window.addEventListener('resize', updateDimensions);
    updateDimensions(); // Initial call

    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const handleVehicleSpawned = useCallback((direction: Direction) => {
    incrementVehicleCount(direction);
  }, [incrementVehicleCount]);

  const { vehicles, resetVehicles } = useVehicles({
    config,
    signalState,
    isRunning,
    virtualWidth: virtualDimensions.width,
    virtualHeight: virtualDimensions.height,
    onVehicleSpawned: handleVehicleSpawned,
  });

  const handleReset = useCallback(() => {
    reset();
    resetVehicles();
    resetVehicleCounts();
  }, [reset, resetVehicles, resetVehicleCounts]);

  /**
   * Handles automatic signal control.
   * 
   * AUTOMATIC MODE (no DQN):
   *   Simple fixed-interval rule: switch signal every 6 seconds.
   *   No agent, no learning, no observations — pure timed switching.
   * 
   * AUTOMATIC + DQN MODE:
   *   Uses DQN agent with epsilon-greedy policy and experience replay.
   *   Stores experiences and trains on replay buffer.
   *   Decision window (5–15s) enforced by signalController.
   */
  const makeAgentDecision = useCallback(() => {
    // ─── AUTOMATIC MODE: simple 6-second fixed-interval switching ───────────
    if (!dqnMode) {
      const elapsed = signalController.getTimeSinceLastChange();
      if (elapsed >= 6) {
        const currentPhase = signalController.getCurrentPhase();
        const nextPhase: SignalPhase = currentPhase === 'NS' ? 'EW' : 'NS';
        // applyAgentDecision(force=true) handles both controller update and React state
        applyAgentDecision(nextPhase, true);
        console.log(`[Auto] Timed switch → ${nextPhase} at ${elapsed.toFixed(1)}s`);
      }
      return;
    }

    // ─── DQN MODE: full RL decision pipeline ─────────────────────────────────
    // Check if forced switch due to MAX_GREEN_TIME exceeded without a decision window switch
    if (signalController.mustSwitchSignal()) {
      const currentPhase = signalController.getCurrentPhase();
      const forcedPhase: SignalPhase = currentPhase === 'NS' ? 'EW' : 'NS';
      console.log('[SignalController] FORCED switch due to MAX_GREEN_TIME (15s) exceeded without adaptive switch');
      const switchApplied = applyAgentDecision(forcedPhase, true);
      if (switchApplied) {
        computeAndLogReward(vehicles, true);
      }
      return;
    }

    // Check if we're in the decision window (5-15 seconds)
    if (!signalController.isInDecisionWindow()) {
      return;
    }

    if (!lastAgentObservation) {
      return;
    }

    // DQN agent selects action using epsilon-greedy policy with congestion bias
    const agentAction: AgentAction = dqnAgent.selectAction(lastAgentObservation);

    // Capture Q-value decision for display
    const decision = dqnAgent.getLastDecision();
    if (decision) {
      setLastQValueDecision(decision);
      setQValueHistory(dqnAgent.getQValueHistory());
    }

    // Store previous observation for DQN training
    const previousObservation = lastObservationRef.current;
    lastObservationRef.current = lastAgentObservation;

    // Apply the agent's decision
    const switchApplied = applyAgentDecision(agentAction);

    // Compute reward using Traffic State (ground truth)
    const wasSwitched = switchApplied && agentAction !== 'KEEP';
    const rewardComponents = computeAndLogReward(vehicles, wasSwitched);

    // Train DQN agent if we have a previous observation
    if (previousObservation && lastAgentObservation) {
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

  // ─────────────────────────────────────────────────────────────────────────
  // COMPARISON LOGGING: log one timestep per second while running.
  // Reads Traffic State (.base = ground truth, no noise).
  // Uses a ref for fast-changing values so the interval is NEVER torn down
  // by frame-by-frame vehicle updates (vehicles changes every ~16ms).
  // ─────────────────────────────────────────────────────────────────────────
  const currentMode = resolveMode(agentEnabled, dqnMode, trainingNoiseConfig);
  const prevModeRef = useRef(currentMode);

  // Keep latest snapshot of fast-changing values for the stable interval to read
  const loggingRef = useRef({ vehicles, config, signalState, lastSignalChangeTime, currentMode });
  useEffect(() => {
    loggingRef.current = { vehicles, config, signalState, lastSignalChangeTime, currentMode };
  });

  // Start a fresh session whenever the mode changes
  useEffect(() => {
    prevModeRef.current = currentMode;
    startSession(currentMode);
  }, [currentMode]);

  // Stable 1-second interval — only depends on isRunning and currentMode
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      const { vehicles: v, config: c, signalState: s, lastSignalChangeTime: lsc, currentMode: mode } =
        loggingRef.current;

      const envState = getEnvironmentState(v, c, s, lsc);

      // Traffic State ground truth (.base) — no noise
      const queueLength  = envState.ns.queueLength.base  + envState.ew.queueLength.base;
      const avgWaitingTime =
        (envState.ns.avgWaitingTime.base + envState.ew.avgWaitingTime.base) / 2;
      const flowRate = envState.ns.flowRate.base + envState.ew.flowRate.base;

      const rewardComponents = computeReward(envState, false);

      logTimestep(mode, {
        queueLength,
        avgWaitingTime,
        flowRate,
        reward: rewardComponents.totalReward,
      });

      setDataVersion((v) => v + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, currentMode]); // stable deps — no vehicles/config/signalState

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-background to-muted flex flex-col overflow-x-hidden">
      {/* Global Fixed Overlays (Navbar Style) */}
      
      {/* 1. Mechanism Mode Indicator - Fixed Top Left */}
      <div className="fixed top-6 left-6 z-50">
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/90 backdrop-blur-xl border border-border shadow-xl ring-1 ring-black/5">
          <div className={`w-2 h-2 rounded-full ${agentEnabled ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
            {!agentEnabled ? 'MANUAL' : (dqnMode ? 'deterministic learning model' : 'Automatic rule-based')}
          </span>
        </div>
      </div>

      {/* 2. Simulation Overlay Controls - Fixed Top Center */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 flex items-center gap-3 z-50">
        {/* Manual Controls Toolbar */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white border border-border shadow-xl transition-all hover:bg-slate-50 group">
          <button
            onClick={() => changeSignal(signalState.NS === 'green' ? 'EW' : 'NS')}
            disabled={agentEnabled}
            className={`p-2.5 rounded-xl transition-all active:scale-90 ${agentEnabled ? 'opacity-20 cursor-not-allowed' : 'hover:bg-slate-100 text-slate-900 hover:text-blue-600'}`}
            title="Switch Signal Direction"
            aria-label="Switch Signal Direction"
          >
            <ArrowLeftRight className="w-5 h-5" />
          </button>
          <div className="w-px h-4 bg-border/50 mx-1" />
          <button
            onClick={isRunning ? pause : start}
            className={`p-2.5 rounded-xl transition-all active:scale-90 hover:bg-slate-100 text-slate-900 ${isRunning ? 'hover:text-amber-600' : 'hover:text-green-600'}`}
            title={isRunning ? "Pause Simulation" : "Start Simulation"}
            aria-label={isRunning ? "Pause Simulation" : "Start Simulation"}
          >
            {isRunning ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current" />
            )}
          </button>
          <div className="w-px h-4 bg-border/50 mx-1" />
          <button
            onClick={handleReset}
            className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-900 hover:text-red-600 transition-all active:scale-90"
            title="Restart Simulation"
            aria-label="Restart Simulation"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>

        {/* Automatic Agent Toggle (Gear) */}
        <button
          onClick={() => enableAgent(!agentEnabled)}
          className={`flex items-center justify-center p-3 rounded-2xl border shadow-xl transition-all active:scale-90 ${
            agentEnabled 
              ? 'bg-slate-900 border-slate-900 text-white shadow-slate-200' 
              : 'bg-white border-border text-slate-900 hover:bg-slate-50 hover:text-blue-600'
          }`}
          title={agentEnabled ? "Disable Automatic Agent" : "Enable Automatic Agent"}
          aria-label="Toggle Automatic Agent"
        >
          <Settings className={`w-6 h-6 ${agentEnabled ? 'animate-spin-slow' : ''}`} />
        </button>

        {/* DQN Learning Mode Toggle (Bot) */}
        <button
          onClick={() => setDqnModeEnabled(!dqnMode)}
          disabled={!agentEnabled}
          className={`flex items-center justify-center p-3 rounded-2xl border shadow-xl transition-all active:scale-90 ${
            !agentEnabled 
              ? 'opacity-30 cursor-not-allowed bg-white border-border text-slate-400' 
              : dqnMode 
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-200' 
                : 'bg-white border-border text-slate-900 hover:bg-slate-50 hover:text-indigo-600'
          }`}
          title={!agentEnabled ? "Enable Automatic Agent to use DQN Learning" : (dqnMode ? "Disable DQN Learning" : "Enable DQN Learning")}
          aria-label="Toggle DQN Learning"
        >
          <Bot className={`w-6 h-6 ${dqnMode && agentEnabled ? 'animate-pulse' : ''}`} />
        </button>
      </div>

      {/* Filter Settings Toggle - Fixed Top Right */}
      {isFilterOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsFilterOpen(false)} 
        />
      )}
      
      <div className="fixed top-6 right-6 z-50">
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsFilterOpen(!isFilterOpen);
            }}
            className={`flex items-center justify-center p-3 rounded-2xl border shadow-xl transition-all active:scale-90 ${
              isFilterOpen 
                ? 'bg-blue-600 border-blue-600 text-white shadow-blue-200' 
                : 'bg-white border-border text-slate-900 hover:bg-slate-50 hover:text-blue-600'
            }`}
            title="Traffic & Sensor Settings"
            aria-label="Toggle Settings"
          >
            <Filter className="w-6 h-6" />
          </button>
          
          {isFilterOpen && (
            <div 
              className="absolute top-16 right-0 w-72 p-4 rounded-2xl bg-white/95 backdrop-blur-xl border border-border shadow-2xl z-50 animate-in fade-in slide-in-from-top-4 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-5">
                <header className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold text-slate-900">Environment Setup</h3>
                  <button onClick={() => setIsFilterOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </header>
                
                {/* Group 1: Environment Dynamics */}
                <div className="space-y-4">
                  <header className="flex items-center gap-1.5 border-b border-emerald-100 pb-1.5 mb-2">
                    <Activity className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Environment Dynamics</span>
                  </header>

                  {/* Overall Randomness */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-[10px] font-semibold text-slate-600">Base Randomness</Label>
                      <span className="text-[10px] font-mono bg-emerald-50 px-1.5 py-0.5 rounded text-emerald-700">{(config.trafficRandomness * 100).toFixed(0)}%</span>
                    </div>
                    <Slider 
                      value={[config.trafficRandomness]} 
                      min={0} max={1} step={0.01} 
                      onValueChange={(val) => setTrafficRandomness(val[0])}
                    />
                  </div>

                  {/* Spawn Jitter */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-[10px] font-semibold text-slate-600">Spawn Jitter</Label>
                      <span className="text-[10px] font-mono bg-emerald-50 px-1.5 py-0.5 rounded text-emerald-700">{(config.environmentNoise.spawnJitter * 100).toFixed(0)}%</span>
                    </div>
                    <Slider 
                      value={[config.environmentNoise.spawnJitter]} 
                      min={0} max={1} step={0.01} 
                      onValueChange={(val) => setEnvironmentNoise({ spawnJitter: val[0] })}
                    />
                  </div>

                  {/* Speed Variance */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-[10px] font-semibold text-slate-600">Speed Variance</Label>
                      <span className="text-[10px] font-mono bg-emerald-50 px-1.5 py-0.5 rounded text-emerald-700">{(config.environmentNoise.speedVariance * 100).toFixed(0)}%</span>
                    </div>
                    <Slider 
                      value={[config.environmentNoise.speedVariance]} 
                      min={0} max={1} step={0.01} 
                      onValueChange={(val) => setEnvironmentNoise({ speedVariance: val[0] })}
                    />
                  </div>

                  {/* Directional Bias */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-[10px] font-semibold text-slate-600">Directional Bias (NS vs EW)</Label>
                      <span className="text-[10px] font-mono bg-emerald-50 px-1.5 py-0.5 rounded text-emerald-700">{config.environmentNoise.directionalBias > 0 ? 'NS Heavy' : config.environmentNoise.directionalBias < 0 ? 'EW Heavy' : 'Balanced'}</span>
                    </div>
                    <Slider 
                      value={[config.environmentNoise.directionalBias]} 
                      min={-1} max={1} step={0.1} 
                      onValueChange={(val) => setEnvironmentNoise({ directionalBias: val[0] })}
                    />
                  </div>
                </div>

                <Separator className="my-2 bg-slate-100" />

                {/* Group 2: Training Noise */}
                <div className="space-y-4">
                  <header className="flex items-center gap-1.5 border-b border-blue-100 pb-1.5 mb-2">
                    <Eye className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Training (Observation) Noise</span>
                  </header>

                  {/* Queue Noise */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-[10px] font-semibold text-slate-600">Queue Metric Error</Label>
                      <span className="text-[10px] font-mono bg-blue-50 px-1.5 py-0.5 rounded text-blue-700">±{trainingNoiseConfig.queueLengthNoise}</span>
                    </div>
                    <Slider 
                      value={[trainingNoiseConfig.queueLengthNoise]} 
                      min={0} max={10} step={1} 
                      onValueChange={(val) => setTrainingNoiseConfig({...trainingNoiseConfig, queueLengthNoise: val[0]})}
                    />
                  </div>

                  {/* Waiting Time Noise */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-[10px] font-semibold text-slate-600">Wait Time Error</Label>
                      <span className="text-[10px] font-mono bg-blue-50 px-1.5 py-0.5 rounded text-blue-700">{(trainingNoiseConfig.avgWaitingTimeNoise * 100).toFixed(0)}%</span>
                    </div>
                    <Slider 
                      value={[trainingNoiseConfig.avgWaitingTimeNoise]} 
                      min={0} max={0.5} step={0.01} 
                      onValueChange={(val) => setTrainingNoiseConfig({...trainingNoiseConfig, avgWaitingTimeNoise: val[0]})}
                    />
                  </div>
                </div>
                
                <div className="pt-2 border-t border-slate-100 italic text-[9px] text-slate-400 text-center leading-tight">
                  Environment: physics variability<br/>
                  Training: agent perception error
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Responsive Dashboard */}
      <main className="flex-1 flex flex-col w-full">
        {/* Simulation Panel (full height/width rectangle) */}
        <section className="relative flex justify-center items-center w-full h-screen">
          <div className="w-full h-full">
            <div className="relative w-full h-full">
              <IntersectionView
                vehicles={vehicles}
                signalState={signalState}
                config={config}
                elapsedTimeSeconds={elapsedTimeSeconds}
                agentEnabled={agentEnabled}
                virtualWidth={virtualDimensions.width}
                virtualHeight={virtualDimensions.height}
              />
            </div>
          </div>
        </section>

        {/* Metrics + Control panels side-by-side - Constrained for readability */}
        <section className="max-w-7xl mx-auto w-full px-4 pt-12 pb-8">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Metrics Panel */}
          <div className="xl:h-[750px] w-full overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col">
            <div className="flex-1 overflow-auto custom-scrollbar pr-2">
              <MetricsDisplay
                vehicles={vehicles}
                config={config}
                lastSignalChangeTime={lastSignalChangeTime}
                isRunning={isRunning}
                signalState={signalState}
                trainingNoiseConfig={effectiveTrainingNoiseConfig}
                trainingNoiseEnabled={trainingNoiseEnabled}
                agentEnabled={agentEnabled}
                onNoisyObservationUpdate={setLastAgentObservation}
                hasSimulationBeenStarted={hasSimulationBeenStarted}
                simulationSessionId={simulationSessionId}
                virtualBaseState={virtualBaseState}
              />
            </div>
          </div>

          {/* Control Panel */}
          <div className="xl:h-[750px] w-full overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col">
            <div className="max-w-3xl mx-auto w-full flex-1 overflow-auto custom-scrollbar pr-2">
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
                trainingNoiseConfig={trainingNoiseConfig}
                trainingNoiseEnabled={trainingNoiseEnabled}
                agentEnabled={agentEnabled}
                dqnMode={dqnMode}
                dqnMetrics={dqnMetrics}
                onStart={start}
                onPause={pause}
                onReset={handleReset}
                onSignalChange={changeSignal}
                onTrafficRandomnessChange={setTrafficRandomness}
                onTrainingNoiseConfigChange={setTrainingNoiseConfig}
                onTrainingNoiseEnabledChange={setTrainingNoiseEnabled}
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
        </div>
      </section>

      {/* Comparison Dashboard — full width below main panels */}
      <section className="max-w-7xl mx-auto w-full px-4 pb-10">
        <ComparisonDashboard
          dataVersion={dataVersion}
          onClear={() => setDataVersion(0)}
        />
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
                  trainingNoiseConfig={trainingNoiseConfig}
                  trainingNoiseEnabled={trainingNoiseEnabled}
                  agentEnabled={agentEnabled}
                  dqnMode={dqnMode}
                  dqnMetrics={dqnMetrics}
                  onStart={start}
                  onPause={pause}
                  onReset={handleReset}
                  onSignalChange={changeSignal}
                  onTrafficRandomnessChange={setTrafficRandomness}
                  onTrainingNoiseConfigChange={setTrainingNoiseConfig}
                  onTrainingNoiseEnabledChange={setTrainingNoiseEnabled}
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