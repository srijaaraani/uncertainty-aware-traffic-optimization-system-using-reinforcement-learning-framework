/**
 * Traffic Signal Control Agent (Rule-Based Baseline)
 *
 * This agent observes ONLY noisy traffic metrics (from the probabilistic sensor model)
 * and decides which signal phase (NS or EW) should be green.
 *
 * IMPORTANT CONSTRAINTS:
 * - Uses ONLY noisy observation values (never accesses true environment state)
 * - No learning, no reward computation, no Q-values
 * - No neural networks or training loops
 * - Serves as a baseline policy before RL training
 * - Uses observation history to require persistent congestion before switching
 *
 * PURPOSE:
 * - Establish the basic agent control loop
 * - Demonstrate how noisy observations affect decision-making
 * - Provide a baseline for future RL-based improvements
 * - Enable diverse switching timings (5-15s) through persistence checks
 *
 * DECISION MECHANISM:
 * - Accumulates observations over time (up to 5 observations)
 * - Only switches if OTHER direction shows higher congestion in MULTIPLE consecutive observations
 * - Uses adaptive thresholds: as time passes, becomes willing to switch with smaller differences
 * - This creates natural variation in switching times across scenarios
 *
 * FUTURE ENHANCEMENTS (to be added in later stages):
 * - Reinforcement learning (Q-learning, policy gradients, etc.)
 * - Reward functions based on traffic optimization metrics
 * - Multi-agent coordination for multiple intersections
 * - Parameter learning and adaptation
 */

/**
 * Represents the signal phase (which direction has green light)
 */
export type SignalPhase = 'NS' | 'EW';

/**
 * Agent action: either switch to a specific phase or keep the current phase
 */
export type AgentAction = SignalPhase | 'KEEP';

/**
 * Observation structure for the agent.
 * Contains ONLY noisy metrics sampled from probability distributions.
 * The agent never sees the true traffic state.
 */
export interface AgentObservation {
  /** Current active signal phase */
  signalPhase: SignalPhase;
  
  /** North-South direction metrics (noisy observations) */
  ns: {
    /** Queue length of waiting vehicles (discrete, noisy) */
    queueLength: number;
    /** Average waiting time in seconds (continuous, noisy) */
    avgWaitingTime: number;
  };
  
  /** East-West direction metrics (noisy observations) */
  ew: {
    /** Queue length of waiting vehicles (discrete, noisy) */
    queueLength: number;
    /** Average waiting time in seconds (continuous, noisy) */
    avgWaitingTime: number;
  };
}

/**
 * Internal state for tracking observations over time
 */
interface CongestionComparison {
  timestamp: number;
  otherIsBusy: boolean; // True if other direction > (current * threshold)
}

/**
 * Traffic Signal Control Agent
 *
 * A rule-based agent that decides signal timing based on observed congestion.
 * Uses observation history to require persistent congestion patterns before switching.
 * This creates diverse switching timings within the 5-15 second decision window.
 */
export class TrafficSignalAgent {
  private lastDecision: AgentAction = 'NS';
  private decisionCount: number = 0;
  
  // Observation history for persistence checking
  private observationHistory: CongestionComparison[] = [];
  private maxHistorySize: number = 5;

  /**
   * Decides whether to switch signal phase or keep the current phase.
   *
   * POLICY:
   * 1. Calculate congestion for each direction (queue length + waiting time)
   * 2. Check if OTHER direction is more congested than CURRENT direction
   * 3. Accumulate this assessment in observation history (max 5 observations)
   * 4. Switch ONLY if:
   *    - At least 2 consecutive observations agree that other is busier
   *    - AND the congestion difference is meaningful (threshold-based)
   * 5. Otherwise, KEEP current phase to allow continued traffic clearing
   *
   * ADAPTIVE THRESHOLDS:
   * - With 1 observation: Don't switch (too early, might be noise)
   * - With 2 observations: Require 50% difference (1.5x threshold)
   * - With 3+ observations: Require 30% difference (1.3x threshold)
   * - This allows later switching when persistence is demonstrated
   *
   * RESULT: Switching times vary naturally between 5-15 seconds based on actual traffic.
   *
   * @param observation - The noisy observation from the probabilistic sensor model
   * @returns 'NS' or 'EW' to switch to that phase, or 'KEEP' to maintain current phase
   */
  decideAction(observation: AgentObservation): AgentAction {
    const currentPhase = observation.signalPhase;
    const now = Date.now();

    // Calculate total congestion metric for each direction
    const nsCongestion = 
      observation.ns.queueLength + 
      (observation.ns.avgWaitingTime / 10);

    const ewCongestion = 
      observation.ew.queueLength + 
      (observation.ew.avgWaitingTime / 10);

    // Determine other direction
    const otherPhase: SignalPhase = currentPhase === 'NS' ? 'EW' : 'NS';
    const currentCongestion = currentPhase === 'NS' ? nsCongestion : ewCongestion;
    const otherCongestion = currentPhase === 'NS' ? ewCongestion : nsCongestion;

    // Adaptive threshold based on observation count
    // Early observations need stronger evidence (1.5x), later observations need less (1.3x)
    let threshold = 1.5; // Default: require 50% more congestion
    if (this.observationHistory.length >= 2) {
      threshold = 1.3; // With 2+ observations, require only 30% more
    }

    // Assess if other direction is busier this observation
    const otherIsMoreCongested = otherCongestion > (currentCongestion * threshold);

    // Track this observation
    this.observationHistory.push({
      timestamp: now,
      otherIsBusy: otherIsMoreCongested,
    });

    // Keep only recent observations (last 5)
    if (this.observationHistory.length > this.maxHistorySize) {
      this.observationHistory.shift();
    }

    // Decision logic: require persistence before switching
    let decision: AgentAction = 'KEEP';

    // Only consider switching if we have at least 2 observations
    if (this.observationHistory.length >= 2) {
      // Check if the last 2 observations agree that other is busier
      const recentHistory = this.observationHistory.slice(-2);
      const bothAgreeBusier = recentHistory.every(obs => obs.otherIsBusy);

      if (bothAgreeBusier) {
        // Other direction has been busier in last 2 observations
        decision = otherPhase;
      }
    }
    // With only 1 observation, always KEEP to avoid early switching based on noise

    this.lastDecision = decision;
    this.decisionCount++;

    return decision;
  }

  /**
   * Reset observation history when signal changes
   * This ensures persistence checks are fresh for each signal phase
   */
  resetHistory(): void {
    this.observationHistory = [];
  }

  /**
   * Gets information about the agent's last decision (for debugging/logging)
   */
  getLastDecisionInfo() {
    return {
      lastDecision: this.lastDecision,
      decisionCount: this.decisionCount,
      observationHistorySize: this.observationHistory.length,
    };
  }
}

/**
 * Singleton instance of the traffic signal agent.
 * Use this to interact with the agent across the application.
 */
export const trafficSignalAgent = new TrafficSignalAgent();
