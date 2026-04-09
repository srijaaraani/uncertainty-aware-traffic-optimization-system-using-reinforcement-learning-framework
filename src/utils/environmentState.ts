/**
 * Environment State Reader
 * 
 * This module provides a function to read and package the current simulation
 * state into a structured format for traffic signal agents.
 * 
 * IMPORTANT: This module contains NO decision-making logic, learning logic,
 * probabilistic noise, reward computation, or state modification.
 * It only collects and packages existing simulation values.
 */

import {
  Vehicle,
  SimulationConfig,
  TrafficLightState,
  SimulationMetrics,
} from '@/types/simulation';
import { calculateMetrics } from './metricsCalculator';

/**
 * A metric represented at three distinct stages of the simulation pipeline.
 */
export interface LayeredMetric {
  base: number;      // Nominal simulation value (pre-noise)
  true: number;      // Actual environment value (post-environment noise)
  observed: number;  // Noisy agent perception (post-observation/training noise)
}

/**
 * Environment state structure representing what the traffic signal agent observes.
 * Metrics are aggregated by direction group (NS = North-South, EW = East-West).
 */
export interface EnvironmentState {
  /**
   * Current traffic signal phase
   * 'NS' = North-South has green, 'EW' = East-West has green
   */
  signalPhase: 'NS' | 'EW';

  /**
   * North-South direction metrics (aggregated from north and south lanes)
   */
  ns: {
    queueLength: LayeredMetric;
    avgWaitingTime: LayeredMetric;
    maxWaitingTime: LayeredMetric;
    flowRate: LayeredMetric;
    avgSpeed: LayeredMetric;
  };

  /**
   * East-West direction metrics (aggregated from east and west lanes)
   */
  ew: {
    queueLength: LayeredMetric;
    avgWaitingTime: LayeredMetric;
    maxWaitingTime: LayeredMetric;
    flowRate: LayeredMetric;
    avgSpeed: LayeredMetric;
  };
}

/**
 * Aggregates lane-level metrics for a direction group (NS or EW)
 */
function aggregateDirectionMetrics(
  laneMetrics: SimulationMetrics['laneMetrics'],
  directions: ('north' | 'south')[] | ('east' | 'west')[],
  config: SimulationConfig
): {
  queueLength: number;
  avgWaitingTime: number;
  maxWaitingTime: number;
  flowRate: number;
  avgSpeed: number;
} {
  let totalQueueLength = 0;
  let totalFlowRate = 0;
  let totalAvgSpeed = 0;
  let maxWaitingTime = 0;
  let totalWaitingTime = 0;
  let totalWaitingVehicles = 0;
  let laneCount = 0;

  directions.forEach((direction) => {
    const numLanes = config.laneConfig[direction];

    for (let lane = 0; lane < numLanes; lane++) {
      const key = `${direction}-${lane}`;
      const metrics = laneMetrics[key];

      if (!metrics) {
        continue;
      }

      laneCount++;
      totalQueueLength += metrics.queueLength;
      totalFlowRate += metrics.flowRate;

      // For average speed, accumulate and average across lanes
      if (metrics.avgSpeed > 0) {
        totalAvgSpeed += metrics.avgSpeed;
      }

      // For max waiting time, take the maximum across all lanes
      if (metrics.maxWaitingTime > maxWaitingTime) {
        maxWaitingTime = metrics.maxWaitingTime;
      }

      // For average waiting time, weight by queue length
      if (metrics.queueLength > 0 && metrics.avgWaitingTime > 0) {
        totalWaitingTime += metrics.avgWaitingTime * metrics.queueLength;
        totalWaitingVehicles += metrics.queueLength;
      }
    }
  });

  // Calculate averages
  const avgSpeed = laneCount > 0 ? totalAvgSpeed / laneCount : 0;
  const avgWaitingTime =
    totalWaitingVehicles > 0
      ? totalWaitingTime / totalWaitingVehicles
      : 0;

  return {
    queueLength: totalQueueLength,
    avgWaitingTime,
    maxWaitingTime,
    flowRate: totalFlowRate,
    avgSpeed,
  };
}

/**
 * Reads the current simulation state and packages it into a 3-layer environment state.
 * 
 * Pipeline:
 *   real vehicles → calculateMetrics() → Base layer
 *   Base + env noise delta               → True layer  (post-environment-noise)
 *   True + training noise sampling        → Observed layer (post-observation-noise, done in applyTrainingNoise)
 * 
 * @param vehicles - Current list of vehicles in the simulation
 * @param config - Current simulation configuration (environmentNoise drives True-layer deltas)
 * @param signalState - Current traffic signal state
 * @param lastSignalChangeTime - Timestamp of last signal change
 * @returns EnvironmentState with Base, True, and Observed=0 layers (Observed filled by applyTrainingNoise)
 */
export function getEnvironmentState(
  vehicles: Vehicle[],
  config: SimulationConfig,
  signalState: TrafficLightState,
  lastSignalChangeTime: number
): EnvironmentState {
  // Calculate metrics using existing calculator
  const metrics = calculateMetrics(vehicles, config, lastSignalChangeTime);

  // Determine current signal phase
  const signalPhase: 'NS' | 'EW' = signalState.NS === 'green' ? 'NS' : 'EW';

  // Aggregate NS direction metrics (north + south)
  const nsMetrics = aggregateDirectionMetrics(
    metrics.laneMetrics,
    ['north', 'south'],
    config
  );

  // Aggregate EW direction metrics (east + west)
  const ewMetrics = aggregateDirectionMetrics(
    metrics.laneMetrics,
    ['east', 'west'],
    config
  );

  // Base state = exact metrics computed from real simulation vehicles.
  // This is the "nominal" reference before any noise is applied.

  // Apply environment noise as calibrated metric-level deltas for the True State.
  // This ensures noise affects ALL metrics in ALL directions (including flowing/green direction),
  // matching the design: Base → +envNoise → True → +trainingNoise → Observed.
  // 
  // Noise magnitude is seeded from environmentNoise config:
  //   spawnJitter   → controls queue & wait variation (±2-7 vehicles / ±1-3s)
  //   speedVariance → controls speed variation (±5-15%)
  //   directionalBias → controls asymmetric queue variation between NS/EW
  //   burstIntensity  → controls flow rate variation (±5-15%)

  const noiseLevel = config.environmentNoise.spawnJitter; // 0-1 overall noise intensity

  // Queue noise: ±2-7 vehicles depending on noise level
  const maxQueueDelta = 2 + noiseLevel * 5; // at noise=0: ±2, at noise=1: ±7
  const nsQueueDelta = (Math.random() * 2 - 1) * maxQueueDelta
    + config.environmentNoise.directionalBias * maxQueueDelta * 0.5;
  const ewQueueDelta = (Math.random() * 2 - 1) * maxQueueDelta
    - config.environmentNoise.directionalBias * maxQueueDelta * 0.5;

  // Waiting time noise: ±1-3 seconds
  const maxWaitDelta = 1 + noiseLevel * 2;
  const nsWaitDelta = (Math.random() * 2 - 1) * maxWaitDelta;
  const ewWaitDelta = (Math.random() * 2 - 1) * maxWaitDelta;

  // Flow rate noise: ±5-15% of base flow rate
  const flowNoiseFraction = config.environmentNoise.burstIntensity * 0.1 + noiseLevel * 0.05;
  const nsFlowDelta = nsMetrics.flowRate * (Math.random() * 2 - 1) * flowNoiseFraction;
  const ewFlowDelta = ewMetrics.flowRate * (Math.random() * 2 - 1) * flowNoiseFraction;

  // Speed noise: ±5-15% of base speed
  const speedNoiseFraction = config.environmentNoise.speedVariance * 0.15;
  const nsSpeedDelta = nsMetrics.avgSpeed * (Math.random() * 2 - 1) * speedNoiseFraction;
  const ewSpeedDelta = ewMetrics.avgSpeed * (Math.random() * 2 - 1) * speedNoiseFraction;

  // Clamp true values to non-negative
  const clamp = (base: number, delta: number) => Math.max(0, base + delta);

  // Return structured environment state with layered metrics
  return {
    signalPhase,
    ns: {
      queueLength: {
        base: nsMetrics.queueLength,
        true: clamp(nsMetrics.queueLength, nsQueueDelta),
        observed: 0
      },
      avgWaitingTime: {
        base: nsMetrics.avgWaitingTime,
        true: clamp(nsMetrics.avgWaitingTime, nsWaitDelta),
        observed: 0
      },
      maxWaitingTime: {
        base: nsMetrics.maxWaitingTime,
        true: clamp(nsMetrics.maxWaitingTime, nsWaitDelta * 1.5),
        observed: 0
      },
      flowRate: {
        base: nsMetrics.flowRate,
        true: clamp(nsMetrics.flowRate, nsFlowDelta),
        observed: 0
      },
      avgSpeed: {
        base: nsMetrics.avgSpeed,
        true: clamp(nsMetrics.avgSpeed, nsSpeedDelta),
        observed: 0
      },
    },
    ew: {
      queueLength: {
        base: ewMetrics.queueLength,
        true: clamp(ewMetrics.queueLength, ewQueueDelta),
        observed: 0
      },
      avgWaitingTime: {
        base: ewMetrics.avgWaitingTime,
        true: clamp(ewMetrics.avgWaitingTime, ewWaitDelta),
        observed: 0
      },
      maxWaitingTime: {
        base: ewMetrics.maxWaitingTime,
        true: clamp(ewMetrics.maxWaitingTime, ewWaitDelta * 1.5),
        observed: 0
      },
      flowRate: {
        base: ewMetrics.flowRate,
        true: clamp(ewMetrics.flowRate, ewFlowDelta),
        observed: 0
      },
      avgSpeed: {
        base: ewMetrics.avgSpeed,
        true: clamp(ewMetrics.avgSpeed, ewSpeedDelta),
        observed: 0
      },
    },
  };
}
