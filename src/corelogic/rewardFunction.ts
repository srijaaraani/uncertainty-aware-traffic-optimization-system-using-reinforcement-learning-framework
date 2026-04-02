/**
 * Traffic Signal Control - Reward Function
 * 
 * This module computes reward values for traffic signal control actions.
 * 
 * IMPORTANT: This module contains ONLY reward computation logic.
 * It does NOT contain:
 * - Decision-making logic
 * - Learning or Q-value updates
 * - Signal control logic
 * - Probabilistic observations
 * 
 * The reward function combines multiple objectives to encourage the agent to:
 * - Minimize congestion (queue length)
 * - Minimize waiting times
 * - Avoid unnecessary signal switching
 * - Maintain smooth traffic flow (encourage speed)
 */

import { EnvironmentState } from '@/utils/environmentState';

/**
 * Breakdown of reward components for analysis and debugging
 */
export interface RewardComponents {
  congestionPenalty: number;    // Penalty for queued vehicles
  waitingTimePenalty: number;   // Penalty for vehicles waiting
  switchingPenalty: number;     // Penalty for changing signal
  flowBonus: number;            // Bonus for vehicle movement
  totalReward: number;          // Weighted sum of all components
}

/**
 * Compute reward for current traffic state and action
 * 
 * The reward reflects overall traffic system performance at a given timestep.
 * Higher reward = better traffic conditions.
 * 
 * @param environmentState Current traffic environment metrics (TRUE values, not noisy)
 * @param signalSwitched Whether the signal phase changed in this timestep
 * @returns Scalar reward value and component breakdown for logging
 */
export function computeReward(
  environmentState: EnvironmentState,
  signalSwitched: boolean
): RewardComponents {
  // ============================================
  // WEIGHT PARAMETERS
  // These control the relative importance of each reward component
  // ============================================
  
  // Congestion penalty weights - these dominate the reward
  const CONGESTION_PENALTY_WEIGHT = -2.0; // Heavily penalize queue buildup
  const MAX_QUEUE_LENGTH = 30; // Reference queue length for normalization
  
  // Waiting time penalty weights
  const WAITING_TIME_PENALTY_WEIGHT = -1.5; // Penalize long waits
  const MAX_WAITING_TIME = 60; // Reference waiting time (seconds) for normalization
  
  // Switching penalty - discourage rapid switching
  const SWITCHING_PENALTY = -0.5; // Small penalty per switch
  
  // Flow encouragement - reward smooth traffic
  const FLOW_BONUS_WEIGHT = 0.3; // Small positive reward for flow
  const MAX_SPEED = 3.0; // Reference speed (pixels/frame) for normalization

  // ============================================
  // 1. CONGESTION PENALTY
  // Negative reward proportional to total queue length across all directions
  // ============================================
  
  const totalQueueLength = environmentState.ns.queueLength + environmentState.ew.queueLength;
  
  // Normalize queue length to a penalty in range [0, 1]
  // Using sigmoidal-like behavior: penalty increases with queue size
  const queueNormalized = Math.min(totalQueueLength / MAX_QUEUE_LENGTH, 1.0);
  const congestionPenalty = CONGESTION_PENALTY_WEIGHT * queueNormalized;

  // ============================================
  // 2. WAITING TIME PENALTY
  // Negative reward proportional to average waiting time
  // ============================================
  
  // Average waiting time across both directions
  const avgWaitingTime = (
    environmentState.ns.avgWaitingTime + 
    environmentState.ew.avgWaitingTime
  ) / 2;
  
  // Normalize waiting time to penalty in range [0, 1]
  const waitingTimeNormalized = Math.min(avgWaitingTime / MAX_WAITING_TIME, 1.0);
  const waitingTimePenalty = WAITING_TIME_PENALTY_WEIGHT * waitingTimeNormalized;

  // ============================================
  // 3. SWITCHING PENALTY
  // Small negative penalty when signal changes
  // Discourages unnecessary switching or rapid oscillation
  // ============================================
  
  const switchingPenalty = signalSwitched ? SWITCHING_PENALTY : 0;

  // ============================================
  // 4. FLOW ENCOURAGEMENT
  // Positive reward for higher average vehicle speed
  // Encourages the agent to maintain smooth traffic flow
  // ============================================
  
  // Average speed across both directions
  const avgSpeed = (
    environmentState.ns.avgSpeed + 
    environmentState.ew.avgSpeed
  ) / 2;
  
  // Normalize speed to bonus in range [0, 1]
  // Speed closer to free-flow gets higher bonus
  const speedNormalized = Math.min(avgSpeed / MAX_SPEED, 1.0);
  const flowBonus = FLOW_BONUS_WEIGHT * speedNormalized;

  // ============================================
  // TOTAL REWARD
  // Weighted sum of all components
  // Weighted terms ensure congestion/waiting time dominate
  // ============================================
  
  const totalReward = 
    congestionPenalty + 
    waitingTimePenalty + 
    switchingPenalty + 
    flowBonus;

  return {
    congestionPenalty,
    waitingTimePenalty,
    switchingPenalty,
    flowBonus,
    totalReward,
  };
}

/**
 * Format reward components for logging/display
 * 
 * @param components Reward component breakdown
 * @returns Human-readable string representation
 */
export function formatRewardComponents(components: RewardComponents): string {
  return (
    `Reward=[Total: ${components.totalReward.toFixed(3)}, ` +
    `Congestion: ${components.congestionPenalty.toFixed(3)}, ` +
    `Waiting: ${components.waitingTimePenalty.toFixed(3)}, ` +
    `Switch: ${components.switchingPenalty.toFixed(3)}, ` +
    `Flow: ${components.flowBonus.toFixed(3)}]`
  );
}
