/**
 * Traffic Signal Simulation - Metrics Calculator
 * 
 * Calculates various traffic metrics from simulation state.
 */

import {
  Vehicle,
  Direction,
  SimulationMetrics,
  LaneMetrics,
  DirectionMetrics,
  SimulationConfig,
} from '@/types/simulation';

const FREE_FLOW_SPEED = 3.0; // Average free-flow speed in pixels per frame
const FLOW_RATE_WINDOW_MS = 60000; // 1 minute window for flow rate calculation

interface VehicleExitRecord {
  direction: Direction;
  lane: number;
  exitTime: number;
}

// Store vehicle exit records for flow rate calculation
let vehicleExitRecords: VehicleExitRecord[] = [];

export function recordVehicleExit(direction: Direction, lane: number): void {
  vehicleExitRecords.push({
    direction,
    lane,
    exitTime: Date.now(),
  });
  
  // Clean up old records (older than 2 minutes)
  const twoMinutesAgo = Date.now() - 120000;
  vehicleExitRecords = vehicleExitRecords.filter(
    (record) => record.exitTime > twoMinutesAgo
  );
}

export function resetMetrics(): void {
  vehicleExitRecords = [];
}

/**
 * Calculate queue length for a specific direction and lane
 */
function calculateQueueLength(
  vehicles: Vehicle[],
  direction: Direction,
  lane: number
): number {
  return vehicles.filter(
    (v) =>
      v.direction === direction &&
      v.lane === lane &&
      v.stopped &&
      !v.throughIntersection
  ).length;
}

/**
 * Calculate waiting times for vehicles in a specific direction and lane
 */
function calculateWaitingTimes(
  vehicles: Vehicle[],
  direction: Direction,
  lane: number
): { avg: number; max: number } {
  const waitingVehicles = vehicles.filter(
    (v) =>
      v.direction === direction &&
      v.lane === lane &&
      v.stopped &&
      !v.throughIntersection &&
      v.waitingStartTime !== null
  );

  if (waitingVehicles.length === 0) {
    return { avg: 0, max: 0 };
  }

  const now = Date.now();
  const waitingTimes = waitingVehicles.map(
    (v) => (now - (v.waitingStartTime || now)) / 1000
  );

  const avg = waitingTimes.reduce((a, b) => a + b, 0) / waitingTimes.length;
  const max = Math.max(...waitingTimes);

  return { avg, max };
}

/**
 * Calculate flow rate (vehicles per minute) for a specific direction and lane
 */
function calculateFlowRate(
  direction: Direction,
  lane: number
): number {
  const oneMinuteAgo = Date.now() - FLOW_RATE_WINDOW_MS;
  const recentExits = vehicleExitRecords.filter(
    (record) =>
      record.direction === direction &&
      record.lane === lane &&
      record.exitTime > oneMinuteAgo
  );

  return recentExits.length; // Vehicles per minute
}

/**
 * Calculate average speed and delay for vehicles in a specific direction and lane
 */
function calculateSpeedAndDelay(
  vehicles: Vehicle[],
  direction: Direction,
  lane: number
): { avgSpeed: number; avgDelay: number } {
  const movingVehicles = vehicles.filter(
    (v) =>
      v.direction === direction &&
      v.lane === lane &&
      !v.stopped
  );

  if (movingVehicles.length === 0) {
    return { avgSpeed: 0, avgDelay: 0 };
  }

  const speeds = movingVehicles.map((v) => v.config.speed);
  const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  
  // Calculate delay as percentage reduction from free-flow speed
  const avgDelay = FREE_FLOW_SPEED > 0 
    ? ((FREE_FLOW_SPEED - avgSpeed) / FREE_FLOW_SPEED) * 100 
    : 0;

  return { avgSpeed, avgDelay: Math.max(0, avgDelay) };
}

/**
 * Calculate metrics for all lanes
 */
export function calculateMetrics(
  vehicles: Vehicle[],
  config: SimulationConfig,
  lastSignalChangeTime: number
): SimulationMetrics {
  const directions: Direction[] = ['north', 'south', 'east', 'west'];
  const laneMetrics: DirectionMetrics = {};
  let totalFlowRate = 0;

  directions.forEach((direction) => {
    const numLanes = config.laneConfig[direction];
    
    for (let lane = 0; lane < numLanes; lane++) {
      const key = `${direction}-${lane}`;
      
      const queueLength = calculateQueueLength(vehicles, direction, lane);
      const { avg: avgWaitingTime, max: maxWaitingTime } = calculateWaitingTimes(
        vehicles,
        direction,
        lane
      );
      const flowRate = calculateFlowRate(direction, lane);
      const { avgSpeed, avgDelay } = calculateSpeedAndDelay(
        vehicles,
        direction,
        lane
      );

      laneMetrics[key] = {
        queueLength,
        avgWaitingTime,
        maxWaitingTime,
        flowRate,
        avgSpeed,
        avgDelay,
      };

      totalFlowRate += flowRate;
    }
  });

  const timeSinceLastSignalChange = (Date.now() - lastSignalChangeTime) / 1000;

  return {
    laneMetrics,
    timeSinceLastSignalChange,
    totalFlowRate,
  };
}
