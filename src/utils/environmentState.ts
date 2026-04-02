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
    queueLength: number; // Total number of vehicles waiting in NS direction
    avgWaitingTime: number; // Average waiting time in seconds
    maxWaitingTime: number; // Maximum waiting time in seconds
    flowRate: number; // Vehicles per minute
    avgSpeed: number; // Average speed (pixels per frame)
  };

  /**
   * East-West direction metrics (aggregated from east and west lanes)
   */
  ew: {
    queueLength: number; // Total number of vehicles waiting in EW direction
    avgWaitingTime: number; // Average waiting time in seconds
    maxWaitingTime: number; // Maximum waiting time in seconds
    flowRate: number; // Vehicles per minute
    avgSpeed: number; // Average speed (pixels per frame)
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
 * Reads the current simulation state and returns a structured environment state
 * representing what the traffic signal agent observes at a given time step.
 * 
 * This function:
 * - Calculates current traffic metrics using existing simulation data
 * - Aggregates metrics by direction group (NS and EW)
 * - Packages the current signal phase
 * - Returns a clean state object for agent observation
 * 
 * @param vehicles - Current list of vehicles in the simulation
 * @param config - Current simulation configuration
 * @param signalState - Current traffic signal state
 * @param lastSignalChangeTime - Timestamp of last signal change
 * @returns EnvironmentState object with NS and EW metrics and current signal phase
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

  // Return structured environment state
  return {
    signalPhase,
    ns: {
      queueLength: nsMetrics.queueLength,
      avgWaitingTime: nsMetrics.avgWaitingTime,
      maxWaitingTime: nsMetrics.maxWaitingTime,
      flowRate: nsMetrics.flowRate,
      avgSpeed: nsMetrics.avgSpeed,
    },
    ew: {
      queueLength: ewMetrics.queueLength,
      avgWaitingTime: ewMetrics.avgWaitingTime,
      maxWaitingTime: ewMetrics.maxWaitingTime,
      flowRate: ewMetrics.flowRate,
      avgSpeed: ewMetrics.avgSpeed,
    },
  };
}
