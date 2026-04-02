/**
 * Signal Controller - Environment-Level Signal Management
 *
 * This module manages traffic signal state and enforces timing constraints.
 * It acts as the environment that receives agent decisions and applies them
 * while respecting minimum green-time constraints (real-world safety requirement).
 *
 * ARCHITECTURE:
 * - The agent proposes actions (which direction should get green)
 * - The signal controller enforces timing rules
 * - The controller only allows switches after MIN_GREEN_TIME has elapsed
 *
 * RESPONSIBILITY SEPARATION:
 * - Agent: Decision logic (observes noisy state, proposes direction)
 * - SignalController: Timing logic (enforces minimum green times)
 * - Hook/Page: Integration logic (manages state, calls controller methods)
 *
 * PURPOSE:
 * - Separates safety constraints (timing) from decision logic (agent)
 * - Models real-world traffic signal requirements
 * - Provides clean, testable API for signal management
 */

import { SignalPhase } from '@/corelogic/agent';

/**
 * Configuration for signal controller behavior
 */
export interface SignalControllerConfig {
  /** Minimum time (in seconds) that a signal must remain green before allowing switches */
  minGreenTime: number;
  /** Maximum time (in seconds) that a signal can remain green before forcing a switch */
  maxGreenTime: number;
}

/**
 * Default configuration:
 * - MIN_GREEN_TIME: 5 seconds (decision window opens earlier for faster response)
 * - MAX_GREEN_TIME: 15 seconds (forced switch happens sooner to prevent starvation)
 * 
 * These shorter windows force the agent to make faster decisions with higher variability.
 */
const DEFAULT_CONFIG: SignalControllerConfig = {
  minGreenTime: 5,
  maxGreenTime: 15,
};

/**
 * Signal Controller
 *
 * Manages traffic signal state and enforces minimum and maximum green-time constraints
 * with an adaptive decision window for agent-based switching.
 *
 * Timing Rules:
 * - 0 to MIN_GREEN_TIME (5s): No switching allowed
 * - MIN_GREEN_TIME to MAX_GREEN_TIME (5-15s): Agent can propose conditional switches
 * - MAX_GREEN_TIME (15s): If no switch occurred, force a switch to prevent starvation
 * 
 * This models real-world traffic signal requirements with adaptive control capabilities.
 * The shorter 5-15s window creates high-frequency decision-making with frequent variability.
 */
export class SignalController {
  /** Current active signal phase */
  private currentPhase: SignalPhase;

  /** Timestamp when current signal phase was activated (in milliseconds) */
  private lastPhaseChangeTime: number;

  /** Whether a switch occurred during the current decision window (10-25s) */
  private switchedInWindow: boolean = false;

  /** Configuration for signal timing behavior */
  private config: SignalControllerConfig;

  /**
   * Initialize the signal controller with a starting phase
   * @param initialPhase Starting signal phase ('NS' or 'EW')
   * @param config Optional configuration (uses defaults if not provided)
   */
  constructor(
    initialPhase: SignalPhase = 'NS',
    config: Partial<SignalControllerConfig> = {}
  ) {
    this.currentPhase = initialPhase;
    this.lastPhaseChangeTime = Date.now();
    this.switchedInWindow = false;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get the current active signal phase
   * @returns Current signal phase ('NS' or 'EW')
   */
  getCurrentPhase(): SignalPhase {
    return this.currentPhase;
  }

  /**
   * Get the time (in seconds) since the last signal change
   * @returns Elapsed time in seconds since last phase change
   */
  getTimeSinceLastChange(): number {
    const elapsedMs = Date.now() - this.lastPhaseChangeTime;
    return elapsedMs / 1000;
  }

  /**
   * Check if we are in the decision window where agent can propose switches
   * Decision window: MIN_GREEN_TIME (10s) to MAX_GREEN_TIME (25s)
   * @returns true if agent can propose switches, false otherwise
   */
  isInDecisionWindow(): boolean {
    const elapsedTime = this.getTimeSinceLastChange();
    return elapsedTime >= this.config.minGreenTime && elapsedTime < this.config.maxGreenTime;
  }

  /**
   * Check if a signal switch is forced (maximum green time exceeded without switching)
   * Only returns true if:
   * 1. MAX_GREEN_TIME has elapsed
   * 2. No switch occurred during the decision window (10-25s)
   * @returns true if forced switch is required, false otherwise
   */
  mustSwitchSignal(): boolean {
    const elapsedTime = this.getTimeSinceLastChange();
    // Force switch if MAX_GREEN_TIME reached AND no adaptive switch has happened in this phase
    return elapsedTime >= this.config.maxGreenTime && !this.switchedInWindow;
  }

  /**
   * Get the time (in seconds) remaining until decision window opens
   * @returns Seconds until MIN_GREEN_TIME elapsed (0 if already in window)
   */
  getTimeUntilDecisionWindow(): number {
    const remaining = this.config.minGreenTime - this.getTimeSinceLastChange();
    return Math.max(0, remaining);
  }

  /**
   * Get the time (in seconds) remaining before forced switch
   * @returns Seconds until MAX_GREEN_TIME elapsed (0 if already forced)
   */
  getTimeUntilForcedSwitch(): number {
    const remaining = this.config.maxGreenTime - this.getTimeSinceLastChange();
    return Math.max(0, remaining);
  }

  /**
   * Attempt to apply an agent's proposed signal change during the decision window
   *
   * This method:
   * 1. Checks if we are in the decision window (10-25 seconds)
   * 2. Checks if the proposed phase is different from current phase
   * 3. If both conditions are met, applies the change and marks window as switched
   * 4. Returns whether the switch was actually applied
   *
   * @param proposedPhase The signal phase proposed by the agent
   * @returns true if the switch was applied, false if it was blocked by timing constraint
   */
  tryApplySwitch(proposedPhase: SignalPhase): boolean {
    // Rule 1: If proposed phase is same as current, no switch needed
    if (proposedPhase === this.currentPhase) {
      return false;
    }

    // Rule 2: Only allow switches within the decision window (10-25 seconds)
    if (!this.isInDecisionWindow()) {
      const elapsedTime = this.getTimeSinceLastChange();
      if (elapsedTime < this.config.minGreenTime) {
        const remainingTime = this.getTimeUntilDecisionWindow();
        console.debug(
          `[SignalController] Switch blocked: ${remainingTime.toFixed(2)}s remaining until decision window opens (MIN_GREEN_TIME: ${this.config.minGreenTime}s)`
        );
      } else {
        console.debug(
          `[SignalController] Switch blocked: outside decision window (past MAX_GREEN_TIME: ${this.config.maxGreenTime}s)`
        );
      }
      return false;
    }

    // Both conditions met: apply the switch and reset timing
    this.currentPhase = proposedPhase;
    this.lastPhaseChangeTime = Date.now();
    this.switchedInWindow = false; // Reset for the new phase
    console.debug(
      `[SignalController] Adaptive switch to ${proposedPhase} at ${this.getTimeSinceLastChange().toFixed(2)}s (in decision window)`
    );
    return true;
  }

  /**
   * Apply a forced signal switch when maximum green time is exceeded without a decision window switch
   * This is used when MAX_GREEN_TIME has elapsed and no adaptive switch occurred.
   * Prevents signal starvation for the opposite direction.
   *
   * @param newPhase The signal phase to switch to (must be different from current)
   * @returns true if switch was applied, false if same as current phase
   */
  forceMaxTimeSwitch(newPhase: SignalPhase): boolean {
    if (newPhase === this.currentPhase) {
      return false;
    }

    this.currentPhase = newPhase;
    this.lastPhaseChangeTime = Date.now();
    this.switchedInWindow = false; // Reset for next cycle
    console.debug(
      `[SignalController] FORCED switch to ${newPhase} - MAX_GREEN_TIME (${this.config.maxGreenTime}s) exceeded without adaptive switch`
    );
    return true;
  }

  /**
   * Force an immediate signal change (for manual control or reset)
   * This bypasses all timing constraints.
   *
   * @param newPhase The signal phase to switch to
   */
  forceSwitch(newPhase: SignalPhase): void {
    this.currentPhase = newPhase;
    this.lastPhaseChangeTime = Date.now();
    this.switchedInWindow = false; // Reset window tracking
    console.debug(`[SignalController] Signal forced to ${newPhase} (manual control)`);
  }

  /**
   * Update the minimum green-time configuration
   * @param minGreenTime New minimum green time in seconds
   */
  setMinGreenTime(minGreenTime: number): void {
    this.config.minGreenTime = Math.max(0, minGreenTime);
    console.debug(`[SignalController] MIN_GREEN_TIME updated to ${this.config.minGreenTime}s`);
  }

  /**
   * Update the maximum green-time configuration
   * @param maxGreenTime New maximum green time in seconds
   */
  setMaxGreenTime(maxGreenTime: number): void {
    this.config.maxGreenTime = Math.max(this.config.minGreenTime, maxGreenTime);
    console.debug(`[SignalController] MAX_GREEN_TIME updated to ${this.config.maxGreenTime}s`);
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<SignalControllerConfig> {
    return { ...this.config };
  }

  /**
   * Reset the controller to initial state
   * @param phase Phase to reset to
   */
  reset(phase: SignalPhase = 'NS'): void {
    this.currentPhase = phase;
    this.lastPhaseChangeTime = Date.now();
    this.switchedInWindow = false;
    console.debug('[SignalController] Reset to initial state');
  }
}

/**
 * Global signal controller instance
 * Initialize with default configuration:
 * - MIN_GREEN_TIME: 5 seconds (decision window opens early)
 * - MAX_GREEN_TIME: 15 seconds (forced switch if no adaptive switch occurred)
 * 
 * Short windows (5-15s) create high-variability scenarios with frequent decision points.
 */
export const signalController = new SignalController('NS', {
  minGreenTime: 5,
  maxGreenTime: 15,
});
