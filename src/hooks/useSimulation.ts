/**
 * Traffic Signal Simulation - Main Simulation Hook
 * 
 * This hook manages the core simulation state and provides
 * methods for controlling the simulation.
 * 
 * IMPORTANT: This hook contains NO decision-making logic.
 * All signal changes are manual. External logic can be
 * connected via callbacks.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  SimulationState,
  SimulationConfig,
  TrafficLightState,
  SignalDirection,
  LaneConfig,
  VehicleCounts,
  SimulationCallbacks,
  TrafficBurstState,
} from '@/types/simulation';
import { resetVehicleIdCounter, TrafficBurstManager } from '@/utils/simulationHelpers';
import { trafficSignalAgent, AgentObservation, AgentAction } from '@/corelogic/agent';
import { signalController } from '@/corelogic/signalController';
import { computeReward, formatRewardComponents } from '@/corelogic/rewardFunction';
import { getEnvironmentState } from '@/utils/environmentState';
import { dqnAgent, TrainingMetrics } from '@/corelogic/dqnAgent';

const DEFAULT_LANE_CONFIG: LaneConfig = {
  north: 2,
  south: 2,
  east: 2,
  west: 2,
};

// Default burst state with no active burst
const DEFAULT_BURST_STATE: TrafficBurstState = {
  activeBurstDirection: null,
  burstIntensity: 1,
  timeRemainingInBurst: 0,
  timeUntilNextBurst: 0,
  directionIntensities: {
    north: 1,
    south: 1,
    east: 1,
    west: 1,
  },
  flowBiasDirection: null,
  flowBiasStrength: 0,
};

const DEFAULT_CONFIG: SimulationConfig = {
  spawnRate: 1.5, // Increased from 1.0 for more vehicles and higher variability
  laneConfig: DEFAULT_LANE_CONFIG,
  intersectionSize: 120,
  roadWidth: 40,
  trafficRandomness: 0.75, // Increased from 0.5 for higher variability
  trafficBurstState: DEFAULT_BURST_STATE,
};

const DEFAULT_SIGNAL_STATE: TrafficLightState = {
  NS: 'green',
  EW: 'red',
};

const DEFAULT_COUNTS: VehicleCounts = {
  north: 0,
  south: 0,
  east: 0,
  west: 0,
};

export interface UseSimulationOptions {
  callbacks?: SimulationCallbacks;
  initialConfig?: Partial<SimulationConfig>;
}

export function useSimulation(options: UseSimulationOptions = {}) {
  const { callbacks, initialConfig } = options;

  // ============================================
  // STATE
  // ============================================

  const [isRunning, setIsRunning] = useState(false);
  const [signalState, setSignalState] = useState<TrafficLightState>(DEFAULT_SIGNAL_STATE);
  const [vehicleCounts, setVehicleCounts] = useState<VehicleCounts>(DEFAULT_COUNTS);
  const [config, setConfig] = useState<SimulationConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig,
  });
  const [lastSignalChangeTime, setLastSignalChangeTime] = useState<number>(Date.now());

  // Agent control state
  const [agentEnabled, setAgentEnabled] = useState(false);
  const [agentDecisionInterval, setAgentDecisionInterval] = useState(1000); // 1 second between decisions

  // DQN agent state
  const [dqnMode, setDqnMode] = useState(false); // false = rule-based, true = DQN
  const [dqnMetrics, setDqnMetrics] = useState<TrainingMetrics | null>(null);
  const lastObservationRef = useRef<AgentObservation | null>(null);

  // Traffic burst manager
  const burstManagerRef = useRef<TrafficBurstManager>(new TrafficBurstManager());

  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  // ============================================
  // SIMULATION CONTROLS
  // ============================================

  const start = useCallback(() => {
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    setIsRunning(false);
    setSignalState(DEFAULT_SIGNAL_STATE);
    setVehicleCounts(DEFAULT_COUNTS);
    setLastSignalChangeTime(Date.now());
    signalController.reset('NS');
    trafficSignalAgent.resetHistory();
    resetVehicleIdCounter();
    burstManagerRef.current.reset();
    setConfig((prev) => ({
      ...prev,
      trafficBurstState: DEFAULT_BURST_STATE,
    }));
  }, []);

  // ============================================
  // SIGNAL CONTROL (MANUAL & AGENT)
  // ============================================

  /**
   * Changes signal state.
   * If agent is enabled, this will be called by the agent automatically.
   * If agent is disabled, manual control is allowed.
   * Uses the signal controller to enforce timing constraints.
   */
  const changeSignal = useCallback((direction: SignalDirection) => {
    // If agent is enabled, ignore manual changes
    if (agentEnabled) {
      console.warn('Agent is active - manual signal changes are disabled');
      return;
    }

    // Manual control bypasses minimum green-time constraints
    const targetPhase: 'NS' | 'EW' = direction === 'NS' ? 'NS' : 'EW';
    signalController.forceSwitch(targetPhase);

    setSignalState((prev) => {
      let newState: TrafficLightState;

      if (direction === 'NS') {
        newState = { NS: 'green', EW: 'red' };
      } else {
        newState = { NS: 'red', EW: 'green' };
      }

      // Track signal change time
      setLastSignalChangeTime(Date.now());

      // Notify external systems of signal change
      if (callbacksRef.current?.onSignalChange) {
        callbacksRef.current.onSignalChange(newState);
      }

      return newState;
    });
  }, [agentEnabled]);

  /**
   * Internal method called by the agent to change the signal.
   * This applies agent decisions while respecting minimum green-time constraints
   * via the signal controller.
   * 
   * Accepts either a specific phase ('NS', 'EW') to switch to, or 'KEEP' to maintain current phase.
   * Returns whether any change was applied.
   * 
   * When a signal switch occurs, resets the agent's observation history so that
   * persistence checks start fresh for the new signal phase.
   */
  const applyAgentDecision = useCallback((action: SignalDirection | 'KEEP', force: boolean = false): boolean => {
    // If agent decides to KEEP current phase, do nothing
    if (action === 'KEEP') {
      return false;
    }

    const targetPhase: 'NS' | 'EW' = action === 'NS' ? 'NS' : 'EW';

    // Let the signal controller check timing constraints (or force it)
    const switchApplied = force
      ? signalController.forceMaxTimeSwitch(targetPhase)
      : signalController.tryApplySwitch(targetPhase);

    // If switch was blocked by timing constraint, don't update UI state
    if (!switchApplied) {
      return false;
    }

    // Switch was approved - reset agent observation history for fresh persistence checking
    trafficSignalAgent.resetHistory();

    // Update UI state
    setSignalState((prev) => {
      let newState: TrafficLightState;

      if (action === 'NS') {
        newState = { NS: 'green', EW: 'red' };
      } else {
        newState = { NS: 'red', EW: 'green' };
      }

      // Track signal change time
      setLastSignalChangeTime(Date.now());

      // Notify external systems of signal change
      if (callbacksRef.current?.onSignalChange) {
        callbacksRef.current.onSignalChange(newState);
      }

      return newState;
    });

    return true;
  }, []);

  // ============================================
  // AGENT CONTROL
  // ============================================

  /**
   * Enable/disable automatic agent control
   */
  const enableAgent = useCallback((enabled: boolean) => {
    setAgentEnabled(enabled);
    if (!enabled) {
      // When disabling agent, reset to manual mode and clear observation history
      setSignalState(DEFAULT_SIGNAL_STATE);
      setLastSignalChangeTime(Date.now());
      signalController.reset('NS');
      trafficSignalAgent.resetHistory();
      if (dqnMode) {
        dqnAgent.reset();
      }
    }
  }, [dqnMode]);

  /**
   * Toggle between rule-based and DQN agent
   */
  const setDqnModeEnabled = useCallback((enabled: boolean) => {
    setDqnMode(enabled);
    if (enabled) {
      // Reset DQN agent when switching to DQN mode
      dqnAgent.reset();
      console.log('[DQN] Switched to DQN learning mode');
    } else {
      console.log('[DQN] Switched to rule-based mode');
    }
  }, []);

  /**
   * Set the interval between agent decisions (in milliseconds)
   */
  const setAgentDecisionIntervalMs = useCallback((intervalMs: number) => {
    setAgentDecisionInterval(Math.max(100, Math.min(10000, intervalMs)));
  }, []);

  /**
   * CORE LOGIC WILL BE CONNECTED HERE LATER
   * 
   * Placeholder for external signal state getter.
   * Returns the current manual signal state.
   */
  const getSignalState = useCallback((): TrafficLightState => {
    // CORE LOGIC WILL BE CONNECTED HERE LATER
    return signalState;
  }, [signalState]);

  // ============================================
  // CONFIGURATION CONTROLS
  // ============================================

  const setSpawnRate = useCallback((rate: number) => {
    setConfig((prev) => ({
      ...prev,
      spawnRate: Math.max(0.1, Math.min(5, rate)),
    }));
  }, []);

  const setLaneConfig = useCallback((laneConfig: LaneConfig) => {
    setConfig((prev) => ({
      ...prev,
      laneConfig,
    }));
  }, []);

  const setTrafficRandomness = useCallback((randomness: number) => {
    setConfig((prev) => ({
      ...prev,
      trafficRandomness: Math.max(0, Math.min(1, randomness)),
    }));
  }, []);

  // ============================================
  // VEHICLE COUNT UPDATES
  // ============================================

  const incrementVehicleCount = useCallback((direction: keyof VehicleCounts) => {
    setVehicleCounts((prev) => ({
      ...prev,
      [direction]: prev[direction] + 1,
    }));
  }, []);

  const resetVehicleCounts = useCallback(() => {
    setVehicleCounts(DEFAULT_COUNTS);
  }, []);

  // ============================================
  // COMPUTED STATE
  // ============================================

  const state: SimulationState = {
    isRunning,
    vehicles: [], // Managed by useVehicles hook
    signalState,
    vehicleCounts,
    config,
  };

  // Agent execution is now handled in Index.tsx component

  // ============================================
  // TRAFFIC BURST MANAGEMENT
  // ============================================

  /**
   * Update traffic burst state when simulation is running
   * Bursts change direction every 20-40 seconds with stochastic timing
   */
  useEffect(() => {
    if (!isRunning) return;

    const updateInterval = setInterval(() => {
      const burstState = burstManagerRef.current.updateBurst();
      setConfig((prev) => ({
        ...prev,
        trafficBurstState: burstState,
      }));
    }, 1000); // Update burst state every second

    return () => clearInterval(updateInterval);
  }, [isRunning]);

  // ============================================
  // REWARD COMPUTATION & LOGGING
  // ============================================

  /**
   * Compute reward for current traffic state and log it.
   * This method should be called after signal changes or at each timestep
   * to track the reward signal.
   * 
   * @param vehicles Array of current vehicles in simulation
   * @param wasSignalSwitched Whether the signal changed in this timestep
   * 
   * IMPORTANT: Reward is computed using TRUE environment metrics (not noisy observations).
   * The reward is logged but NOT used for learning yet - that will be added later.
   */
  const computeAndLogReward = useCallback((
    vehicles: Array<any>,
    wasSignalSwitched: boolean
  ) => {
    // Get true environment state (no noise)
    const envState = getEnvironmentState(vehicles, config, signalState, lastSignalChangeTime);

    // Compute reward components
    const reward = computeReward(envState, wasSignalSwitched);

    // Log reward details for monitoring
    const rewardStr = formatRewardComponents(reward);
    console.log(`[Reward] ${rewardStr}`);

    return reward;
  }, [config, signalState, lastSignalChangeTime]);

  /**
   * Store experience and train DQN agent
   * Called after each agent decision when DQN mode is enabled
   */
  const trainDQNAgent = useCallback((
    observation: AgentObservation,
    action: AgentAction,
    reward: number,
    nextObservation: AgentObservation
  ) => {
    if (!dqnMode) return;

    // Store experience in replay buffer
    dqnAgent.storeExperience(observation, action, reward, nextObservation, false);

    // Train on batch
    dqnAgent.train();

    // Update metrics for display
    const metrics = dqnAgent.getMetrics();
    setDqnMetrics(metrics);

    // Log training progress periodically
    if (metrics.trainingSteps % 50 === 0 && metrics.trainingSteps > 0) {
      console.log(
        `[DQN] Step ${metrics.trainingSteps}: ` +
        `ε=${metrics.epsilon.toFixed(3)}, ` +
        `Loss=${metrics.loss.toFixed(4)}, ` +
        `Experiences=${metrics.experienceCount}`
      );
    }
  }, [dqnMode]);

  return {
    // State
    state,
    isRunning,
    signalState,
    vehicleCounts,
    config,
    lastSignalChangeTime,
    // Controls
    start,
    pause,
    reset,
    // Signal control
    changeSignal,
    getSignalState,
    applyAgentDecision,
    // Configuration
    setSpawnRate,
    setLaneConfig,
    setTrafficRandomness,
    // Vehicle counts
    incrementVehicleCount,
    resetVehicleCounts,
    // Agent control
    agentEnabled,
    agentDecisionInterval,
    enableAgent,
    setAgentDecisionIntervalMs,
    // DQN control
    dqnMode,
    setDqnModeEnabled,
    dqnMetrics,
    trainDQNAgent,
    lastObservationRef,
    // Reward computation
    computeAndLogReward,
  };
}
