/**
 * Probabilistic Sensor Model - Core Logic Module
 * 
 * This module simulates sensor uncertainty by sampling observations from
 * probability distributions centered around true traffic values. It models
 * realistic sensor measurement errors that might occur in real-world traffic
 * monitoring systems.
 * 
 * IMPORTANT: This is a core logic module that:
 * - Contains NO UI components or dependencies
 * - Contains NO decision-making logic, learning logic, or reward computation
 * - Does NOT modify the original environment state
 * - Samples observations from probability distributions and returns a new state object
 * 
 * This module is designed to be used by:
 * - Agent observation processing
 * - Visualization layers
 * - Testing and simulation frameworks
 */

import { EnvironmentState } from '@/utils/environmentState';

/**
 * Training Noise configuration parameters for sensor uncertainty simulation.
 * Each parameter controls the distribution characteristics for a specific metric type.
 */
export interface TrainingNoiseConfig {
  /**
   * Queue length noise: maximum integer deviation k for discrete distribution [v-k, ..., v+k]
   * Example: k=2 means distribution over [v-2, v-1, v, v+1, v+2]
   */
  queueLengthNoise: number;

  /**
   * Average waiting time noise level (0.0 to 1.0)
   * Represents the standard deviation as a fraction of the true value for normal distribution.
   * Example: 0.15 = 15% standard deviation
   */
  avgWaitingTimeNoise: number;

  /**
   * Average speed noise level (0.0 to 1.0)
   * Represents the standard deviation as a fraction of the true value for normal distribution.
   * Example: 0.2 = 20% standard deviation
   */
  avgSpeedNoise: number;
}

/**
 * Default noise configuration with moderate sensor uncertainty.
 */
export const DEFAULT_TRAINING_NOISE_CONFIG: TrainingNoiseConfig = {
  queueLengthNoise: 2,        // ±2 vehicles for discrete distribution
  avgWaitingTimeNoise: 0.15,  // 15% std dev for normal distribution
  avgSpeedNoise: 0.2,         // 20% std dev for normal distribution
};

/**
 * Samples from a discrete probability distribution over integers [v-k, ..., v+k]
 * centered at the true value v. Uses a triangular distribution where values
 * closer to v have higher probability.
 * 
 * @param trueValue - The true metric value (v)
 * @param k - Maximum integer deviation (k)
 * @returns A sampled integer value from [v-k, ..., v+k]
 */
function sampleDiscreteDistribution(trueValue: number, k: number): number {
  if (k <= 0 || trueValue < 0) {
    return Math.max(0, Math.round(trueValue));
  }

  const v = Math.round(trueValue);
  const kInt = Math.max(1, Math.round(k));

  // Create range [v-k, ..., v+k]
  const min = Math.max(0, v - kInt);
  const max = v + kInt;
  const rangeSize = max - min + 1;

  // Generate weights for triangular distribution (higher weight near center)
  const weights: number[] = [];
  let totalWeight = 0;

  for (let i = 0; i < rangeSize; i++) {
    const value = min + i;
    // Triangular weight: distance from center determines weight
    const distance = Math.abs(value - v);
    const weight = kInt + 1 - distance; // Higher weight for values closer to v
    weights.push(weight);
    totalWeight += weight;
  }

  // Normalize weights to probabilities
  const probabilities = weights.map(w => w / totalWeight);

  // Sample from the discrete distribution
  const random = Math.random();
  let cumulative = 0;

  for (let i = 0; i < rangeSize; i++) {
    cumulative += probabilities[i];
    if (random <= cumulative) {
      return min + i;
    }
  }

  // Fallback (should not reach here)
  return v;
}

/**
 * Samples from a bounded normal distribution centered at the true value.
 * Uses Box-Muller transform to generate normal random variables, then
 * truncates to bounds to ensure realistic sensor readings.
 * 
 * @param trueValue - The true metric value (mean of distribution)
 * @param stdDevFraction - Standard deviation as a fraction of true value (0.0 to 1.0)
 * @param minBound - Minimum allowed value (default: 0)
 * @param maxBound - Maximum allowed value (default: 2 * trueValue)
 * @returns A sampled value from the bounded normal distribution
 */
function sampleBoundedNormalDistribution(
  trueValue: number,
  stdDevFraction: number,
  minBound?: number,
  maxBound?: number
): number {
  if (trueValue <= 0 || stdDevFraction <= 0) {
    return Math.max(0, trueValue);
  }

  const mean = trueValue;
  const stdDev = mean * Math.max(0, Math.min(1, stdDevFraction));

  // Set default bounds if not provided
  const min = minBound !== undefined ? minBound : Math.max(0, mean * 0.1);
  const max = maxBound !== undefined ? maxBound : mean * 2;

  // Use Box-Muller transform for normal distribution
  let value: number;
  let attempts = 0;
  const maxAttempts = 100;

  do {
    const u1 = Math.random();
    const u2 = Math.random();
    // Avoid log(0) by ensuring u1 > 0
    const z0 = Math.sqrt(-2 * Math.log(Math.max(1e-10, u1))) * Math.cos(2 * Math.PI * u2);
    value = mean + z0 * stdDev;
    attempts++;
  } while ((value < min || value > max) && attempts < maxAttempts);

  // Clamp to bounds if we couldn't generate a value within bounds
  return Math.max(min, Math.min(max, value));
}

/**
 * Samples from a bounded uniform distribution centered at the true value.
 * Alternative to normal distribution for continuous metrics.
 * 
 * @param trueValue - The true metric value (center of distribution)
 * @param rangeFraction - Half-range as a fraction of true value (0.0 to 1.0)
 * @param minBound - Minimum allowed value (default: 0)
 * @returns A sampled value from the bounded uniform distribution
 */
function sampleBoundedUniformDistribution(
  trueValue: number,
  rangeFraction: number,
  minBound: number = 0
): number {
  if (trueValue <= 0 || rangeFraction <= 0) {
    return Math.max(minBound, trueValue);
  }

  const range = trueValue * Math.max(0, Math.min(1, rangeFraction));
  const min = Math.max(minBound, trueValue - range);
  const max = trueValue + range;

  // Sample uniformly from [min, max]
  return min + Math.random() * (max - min);
}

/**
 * Samples an observation for a discrete metric (queue length).
 * Uses a discrete probability distribution over [v-k, ..., v+k].
 * 
 * @param trueValue - The true queue length value
 * @param k - Maximum integer deviation
 * @returns A sampled integer observation
 */
function sampleDiscreteMetric(trueValue: number, k: number): number {
  return sampleDiscreteDistribution(trueValue, k);
}

/**
 * Samples an observation for a continuous metric (waiting time, speed).
 * Uses a bounded normal distribution centered at the true value.
 * 
 * @param trueValue - The true metric value
 * @param stdDevFraction - Standard deviation as a fraction of true value
 * @returns A sampled continuous observation
 */
function sampleContinuousMetric(trueValue: number, stdDevFraction: number): number {
  return sampleBoundedNormalDistribution(trueValue, stdDevFraction);
}

/**
 * Applies sensor noise to a direction's metrics (NS or EW) by sampling
 * from probability distributions centered at the true values.
 * 
 * @param metrics - Original metrics for a direction
 * @param noiseConfig - Noise configuration parameters
 * @returns New metrics object with sampled observations
 */
function applyNoiseToDirectionMetrics(
  metrics: EnvironmentState['ns'],
  noiseConfig: TrainingNoiseConfig
): EnvironmentState['ns'] {
  return {
    // Discrete metric: sample from discrete distribution [v-k, ..., v+k]
    // Note: We sample the 'observed' value based on the 'true' physical value
    queueLength: {
      ...metrics.queueLength,
      observed: sampleDiscreteMetric(metrics.queueLength.true, noiseConfig.queueLengthNoise)
    },

    // Continuous metrics: sample from bounded normal distribution
    avgWaitingTime: {
      ...metrics.avgWaitingTime,
      observed: sampleContinuousMetric(metrics.avgWaitingTime.true, noiseConfig.avgWaitingTimeNoise)
    },
    maxWaitingTime: {
      ...metrics.maxWaitingTime,
      observed: sampleContinuousMetric(metrics.maxWaitingTime.true, noiseConfig.avgWaitingTimeNoise)
    },

    // Flow rate is not modified (not in requirements), so observed = true
    flowRate: {
      ...metrics.flowRate,
      observed: metrics.flowRate.true
    },

    // Continuous metric: sample from bounded normal distribution
    avgSpeed: {
      ...metrics.avgSpeed,
      observed: sampleContinuousMetric(metrics.avgSpeed.true, noiseConfig.avgSpeedNoise)
    },
  };
}

/**
 * Applies training (observation) noise to an environment state by sampling
 * observations from probability distributions centered at true values.
 * 
 * This function simulates realistic sensor uncertainty:
 * - Discrete metrics (queue length): sampled from discrete distribution [v-k, ..., v+k]
 * - Continuous metrics (waiting time, speed): sampled from bounded normal distributions
 * 
 * The original environment state is NOT modified. A new state object
 * is created and returned with sampled observations.
 * 
 * @param state - The original environment state (will not be modified)
 * @param noiseConfig - Configuration for noise levels (defaults to DEFAULT_TRAINING_NOISE_CONFIG)
 * @returns A new EnvironmentState object with sampled observations
 * 
 * @example
 * ```typescript
 * import { applyTrainingNoise } from '@/corelogic/probabilisticSensorModel';
 * import { getEnvironmentState } from '@/utils/environmentState';
 * 
 * const cleanState = getEnvironmentState(vehicles, config, signalState, lastChangeTime);
 * const noisyState = applyTrainingNoise(cleanState, {
 *   queueLengthNoise: 2,        // ±2 vehicles for discrete distribution
 *   avgWaitingTimeNoise: 0.15,  // 15% std dev for normal distribution
 *   avgSpeedNoise: 0.2          // 20% std dev for normal distribution
 * });
 * ```
 */
export function applyTrainingNoise(
  state: EnvironmentState,
  noiseConfig: TrainingNoiseConfig = DEFAULT_TRAINING_NOISE_CONFIG
): EnvironmentState {
  // Create a new state object (do not modify the original)
  return {
    signalPhase: state.signalPhase, // Signal phase is not noisy (it's directly observable)
    ns: applyNoiseToDirectionMetrics(state.ns, noiseConfig),
    ew: applyNoiseToDirectionMetrics(state.ew, noiseConfig),
  };
}
