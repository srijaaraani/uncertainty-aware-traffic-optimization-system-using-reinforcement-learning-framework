/**
 * Traffic Signal Simulation - Helper Utilities
 * 
 * Pure utility functions for the simulation.
 * These contain NO decision-making logic.
 */

import {
  Vehicle,
  Direction,
  VehicleSize,
  SimulationConfig,
  Position,
  TrafficLightState,
  LightState
} from '@/types/simulation';
import { SignalPhase } from '@/corelogic/agent';

// ============================================
// VEHICLE GENERATION HELPERS
// ============================================

const VEHICLE_COLORS = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#10B981', // green
  '#F59E0B', // amber
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#6366F1', // indigo
  '#F97316', // orange
];

const VEHICLE_SIZES: Record<VehicleSize, { width: number; height: number }> = {
  small: { width: 18, height: 26 },
  medium: { width: 22, height: 36 },
  large: { width: 26, height: 46 },
};

const SPEED_RANGES: Record<VehicleSize, { min: number; max: number }> = {
  small: { min: 2.5, max: 3.5 },
  medium: { min: 2, max: 3 },
  large: { min: 1.5, max: 2.5 },
};

export function generateRandomVehicleConfig() {
  const sizes: VehicleSize[] = ['small', 'medium', 'large'];
  const size = sizes[Math.floor(Math.random() * sizes.length)];
  const color = VEHICLE_COLORS[Math.floor(Math.random() * VEHICLE_COLORS.length)];
  const speedRange = SPEED_RANGES[size];
  const speed = speedRange.min + Math.random() * (speedRange.max - speedRange.min);

  return { size, color, speed };
}

/**
 * Generate vehicle config with environment speed variance applied
 * Higher variance increases speed variation around the base range
 */
export function generateRandomVehicleConfigWithEnvironmentNoise(
  speedVariance: number
) {
  const sizes: VehicleSize[] = ['small', 'medium', 'large'];
  const size = sizes[Math.floor(Math.random() * sizes.length)];
  const color = VEHICLE_COLORS[Math.floor(Math.random() * VEHICLE_COLORS.length)];
  const speedRange = SPEED_RANGES[size];

  // Base speed variation
  let speed = speedRange.min + Math.random() * (speedRange.max - speedRange.min);

  // Apply environment speed variance (realistic: ±5-15% of base speed)
  // speedVariance (0-1) determines the spread; multiplier 1.5 keeps it natural
  const speedSpread = (speedRange.max - speedRange.min) * speedVariance;
  const randomDeviation = (Math.random() - 0.5) * speedSpread * 1.5;
  speed = Math.max(speedRange.min * 0.85, Math.min(speedRange.max * 1.15, speed + randomDeviation));

  return { size, color, speed };
}

export function getVehicleDimensions(size: VehicleSize) {
  return VEHICLE_SIZES[size];
}

// ============================================
// POSITION CALCULATION HELPERS
// ============================================

export function getSpawnPosition(
  direction: Direction,
  lane: number,
  config: SimulationConfig,
  virtualWidth: number = 600,
  virtualHeight: number = 600
): Position {
  const simCenter = 300; // Fixed simulation center
  const laneWidth = config.roadWidth;

  // Calculate lane offset from center line
  const laneOffset = (lane + 0.5) * laneWidth;
  const buffer = 80; // Distance beyond the visual edge to spawn

  switch (direction) {
    case 'north':
      // Spawns at top, travels south (uses right side of road)
      return { x: simCenter + laneOffset, y: simCenter - virtualHeight / 2 - buffer };
    case 'south':
      // Spawns at bottom, travels north (uses right side of road)
      return { x: simCenter - laneOffset, y: simCenter + virtualHeight / 2 + buffer };
    case 'east':
      // Spawns at right, travels west (uses bottom side of road)
      return { x: simCenter + virtualWidth / 2 + buffer, y: simCenter + laneOffset };
    case 'west':
      // Spawns at left, travels east (uses top side of road)
      return { x: simCenter - virtualWidth / 2 - buffer, y: simCenter - laneOffset };
  }
}

export function getStopLinePosition(
  direction: Direction,
  config: SimulationConfig,
  canvasSize: number
): number {
  const center = canvasSize / 2;
  const halfIntersection = config.intersectionSize / 2;
  const stopOffset = 10; // Distance before intersection

  switch (direction) {
    case 'north':
      return center - halfIntersection - stopOffset;
    case 'south':
      return center + halfIntersection + stopOffset;
    case 'east':
      return center + halfIntersection + stopOffset;
    case 'west':
      return center - halfIntersection - stopOffset;
  }
}

export function isVehicleAtStopLine(
  vehicle: Vehicle,
  config: SimulationConfig,
  canvasSize: number
): boolean {
  const stopLine = getStopLinePosition(vehicle.direction, config, canvasSize);
  const { height } = getVehicleDimensions(vehicle.config.size);
  const buffer = height / 2 + 5;

  switch (vehicle.direction) {
    case 'north':
      return vehicle.position.y >= stopLine - buffer && vehicle.position.y <= stopLine + buffer;
    case 'south':
      return vehicle.position.y <= stopLine + buffer && vehicle.position.y >= stopLine - buffer;
    case 'east':
      return vehicle.position.x <= stopLine + buffer && vehicle.position.x >= stopLine - buffer;
    case 'west':
      return vehicle.position.x >= stopLine - buffer && vehicle.position.x <= stopLine + buffer;
  }
}

export function hasVehiclePassedStopLine(
  vehicle: Vehicle,
  config: SimulationConfig,
  canvasSize: number
): boolean {
  const stopLine = getStopLinePosition(vehicle.direction, config, canvasSize);

  switch (vehicle.direction) {
    case 'north':
      return vehicle.position.y > stopLine;
    case 'south':
      return vehicle.position.y < stopLine;
    case 'east':
      return vehicle.position.x < stopLine;
    case 'west':
      return vehicle.position.x > stopLine;
  }
}

export function isVehicleOffScreen(
  vehicle: Vehicle,
  virtualWidth: number = 600,
  virtualHeight: number = 600
): boolean {
  const buffer = 150;
  const simCenter = 300;
  const { x, y } = vehicle.position;

  const minX = simCenter - virtualWidth / 2 - buffer;
  const maxX = simCenter + virtualWidth / 2 + buffer;
  const minY = simCenter - virtualHeight / 2 - buffer;
  const maxY = simCenter + virtualHeight / 2 + buffer;

  return x < minX || x > maxX || y < minY || y > maxY;
}

// ============================================
// SIGNAL HELPERS
// ============================================

export function getSignalForDirection(
  direction: Direction,
  signalState: TrafficLightState
): LightState {
  if (direction === 'north' || direction === 'south') {
    return signalState.NS;
  }
  return signalState.EW;
}

export function shouldVehicleStop(
  vehicle: Vehicle,
  signalState: TrafficLightState,
  config: SimulationConfig,
  canvasSize: number
): boolean {
  // If already through intersection, don't stop
  if (vehicle.throughIntersection) {
    return false;
  }

  const signal = getSignalForDirection(vehicle.direction, signalState);
  const atStopLine = isVehicleAtStopLine(vehicle, config, canvasSize);
  const passedStopLine = hasVehiclePassedStopLine(vehicle, config, canvasSize);

  // Stop if at stop line and light is not green
  if (atStopLine && signal !== 'green') {
    return true;
  }

  // If past stop line, don't stop
  if (passedStopLine) {
    return false;
  }

  return false;
}

// ============================================
// TRAFFIC BURST SYSTEM
// ============================================

/**
 * Tracks direction-specific traffic intensity and burst patterns.
 * Creates natural congestion imbalances that change over time.
 * Also tracks directional flow bias to create situations where keeping 
 * the current signal green is beneficial at times.
 */
export interface TrafficBurstState {
  activeBurstDirection: Direction | null; // Current burst direction (NS means north+south)
  burstIntensity: number; // 0-2 intensity multiplier for active direction
  timeRemainingInBurst: number; // milliseconds until current burst ends
  timeUntilNextBurst: number; // milliseconds until next burst starts
  directionIntensities: Record<Direction, number>; // Individual direction intensity (0-2)
  flowBiasDirection: SignalPhase | null; // Which signal phase has flow bias (NS/EW or null)
  flowBiasStrength: number; // 0-1 strength of the flow bias
}

/**
 * Manages traffic burst timing and direction transitions
 * to create realistic, interpretable traffic patterns with directional flow bias.
 * 
 * The manager now includes:
 * - Direction-specific burst intensities
 * - Flow bias: preference for a direction that changes over time
 * - This creates situations where keeping the current signal is beneficial
 */
export class TrafficBurstManager {
  private currentBurst: {
    direction: Direction | null;
    startTime: number;
    duration: number;
    intensity: number;
  };
  private nextBurstTime: number;

  // Flow bias: creates preference for keeping current signal at times
  private flowBiasState: {
    direction: SignalPhase | null;
    startTime: number;
    duration: number;
    strength: number; // 0-1
  };
  private nextFlowBiasTime: number;

  constructor(private randomSeed: number = Math.random()) {
    this.currentBurst = {
      direction: null,
      startTime: Date.now(),
      duration: 0,
      intensity: 1,
    };
    this.nextBurstTime = Date.now() + this.getRandomBurstGap();

    // Initialize flow bias
    this.flowBiasState = {
      direction: null,
      startTime: Date.now(),
      duration: 0,
      strength: 0,
    };
    this.nextFlowBiasTime = Date.now() + this.getRandomFlowBiasGap();
  }

  /**
   * Generate random burst gap (time between bursts)
   * Range: 10-20 seconds (shorter for higher variability)
   */
  private getRandomBurstGap(): number {
    return 10000 + Math.random() * 10000; // 10-20 seconds
  }

  /**
   * Generate burst duration
   * Range: 10-25 seconds (longer bursts)
   */
  private getBurstDuration(): number {
    return 8000 + Math.random() * 7000; // 8-15 seconds
  }

  /**
   * Generate burst intensity
   * Range: 2.0-5.0 (Significant surge)
   * Multiplied by burstIntensityConfig for environment noise control
   */
  private getBurstIntensity(intensityConfig: number = 1.0): number {
    // Realistic burst: 10-40% increase in spawn probability
    const base = 1.1 + Math.random() * 0.3; // 1.1-1.4x
    return base * intensityConfig;
  }

  /**
   * Generate random flow bias gap
   * Range: 8-18 seconds
   */
  private getRandomFlowBiasGap(): number {
    return 8000 + Math.random() * 10000; // 8-18 seconds
  }

  /**
   * Generate flow bias duration
   * Range: 6-12 seconds
   */
  private getFlowBiasDuration(): number {
    return 6000 + Math.random() * 6000; // 6-12 seconds
  }

  /**
   * Generate flow bias strength
   * Range: 0.3-0.8 (30-80% stronger vehicle arrival for preferred direction)
   */
  private getFlowBiasStrength(): number {
    // Realistic bias: 10-30% preference for one direction
    return 0.1 + Math.random() * 0.2; // 0.1-0.3
  }

  /**
   * Get random signal phase for flow bias (NS or EW)
   */
  private getNextFlowBiasPhase(): SignalPhase {
    return Math.random() < 0.5 ? 'NS' : 'EW';
  }

  /**
   * Get random direction for next burst
   * Prefer NS or EW based on simple alternation to avoid too many bursts in same direction
   */
  private getNextBurstDirection(previousDirection: Direction | null): Direction {
    const directions: Direction[] = ['north', 'south', 'east', 'west'];

    // Filter out directions similar to previous burst
    let candidateDirections = directions;
    if (previousDirection) {
      candidateDirections = directions.filter(d => {
        // If previous was NS-related, favor EW and vice versa
        const prevIsNS = previousDirection === 'north' || previousDirection === 'south';
        const currIsNS = d === 'north' || d === 'south';
        return prevIsNS !== currIsNS ? true : Math.random() < 0.3; // 30% chance to repeat axis
      });
    }

    return candidateDirections[Math.floor(Math.random() * candidateDirections.length)];
  }

  /**
   * Update burst state based on elapsed time and environment noise
   * Call this regularly to manage burst transitions
   */
  updateBurst(burstIntensityConfig: number = 1.0): TrafficBurstState {
    const now = Date.now();

    // Check if current burst should end
    if (
      this.currentBurst.direction !== null &&
      now - this.currentBurst.startTime >= this.currentBurst.duration
    ) {
      this.currentBurst.direction = null;
      this.nextBurstTime = now + this.getRandomBurstGap();
    }

    // Check if new burst should start
    if (this.currentBurst.direction === null && now >= this.nextBurstTime) {
      const previousDir = this.currentBurst.direction;
      this.currentBurst.direction = this.getNextBurstDirection(previousDir);
      this.currentBurst.startTime = now;
      this.currentBurst.duration = this.getBurstDuration();
      this.currentBurst.intensity = this.getBurstIntensity(burstIntensityConfig);
    }

    // Update flow bias state
    if (
      this.flowBiasState.direction !== null &&
      now - this.flowBiasState.startTime >= this.flowBiasState.duration
    ) {
      this.flowBiasState.direction = null;
      this.nextFlowBiasTime = now + this.getRandomFlowBiasGap();
    }

    // Check if new flow bias should start
    if (this.flowBiasState.direction === null && now >= this.nextFlowBiasTime) {
      this.flowBiasState.direction = this.getNextFlowBiasPhase();
      this.flowBiasState.startTime = now;
      this.flowBiasState.duration = this.getFlowBiasDuration();
      this.flowBiasState.strength = this.getFlowBiasStrength();
    }

    return this.getState();
  }

  /**
   * Get current burst state
   */
  getState(): TrafficBurstState {
    const now = Date.now();

    // Calculate direction-specific intensities
    const directionIntensities: Record<Direction, number> = {
      north: 1,
      south: 1,
      east: 1,
      west: 1,
    };

    const burstDirection = this.currentBurst.direction;
    const burstIntensity = this.currentBurst.intensity;

    // Apply burst intensity to active direction(s)
    if (burstDirection) {
      // For a given burst direction, apply intensity to that direction
      // and slightly to opposite direction (realistic traffic patterns)
      directionIntensities[burstDirection] = burstIntensity;

      // Opposite direction gets slight reduction (traffic flowing elsewhere)
      const oppositeDir: Record<Direction, Direction> = {
        north: 'south',
        south: 'north',
        east: 'west',
        west: 'east',
      };
      directionIntensities[oppositeDir[burstDirection]] = Math.max(0.6, burstIntensity - 0.4);
    }

    // Apply flow bias to direction intensities
    // Flow bias creates preference for certain signal phases
    if (this.flowBiasState.direction !== null) {
      const biasPhase = this.flowBiasState.direction;
      const biasStrength = this.flowBiasState.strength; // 0.3-0.8

      if (biasPhase === 'NS') {
        // Boost N/S, reduce E/W
        directionIntensities.north = Math.min(2.5, directionIntensities.north * (1 + biasStrength));
        directionIntensities.south = Math.min(2.5, directionIntensities.south * (1 + biasStrength));
        directionIntensities.east = Math.max(0.5, directionIntensities.east * (1 - biasStrength * 0.3));
        directionIntensities.west = Math.max(0.5, directionIntensities.west * (1 - biasStrength * 0.3));
      } else {
        // Boost E/W, reduce N/S
        directionIntensities.east = Math.min(2.5, directionIntensities.east * (1 + biasStrength));
        directionIntensities.west = Math.min(2.5, directionIntensities.west * (1 + biasStrength));
        directionIntensities.north = Math.max(0.5, directionIntensities.north * (1 - biasStrength * 0.3));
        directionIntensities.south = Math.max(0.5, directionIntensities.south * (1 - biasStrength * 0.3));
      }
    }

    const timeRemaining =
      burstDirection !== null
        ? Math.max(
          0,
          this.currentBurst.duration - (now - this.currentBurst.startTime)
        )
        : 0;

    const timeUntilNext =
      burstDirection === null ? Math.max(0, this.nextBurstTime - now) : 0;

    return {
      activeBurstDirection: burstDirection,
      burstIntensity,
      timeRemainingInBurst: timeRemaining,
      timeUntilNextBurst: timeUntilNext,
      directionIntensities,
      flowBiasDirection: this.flowBiasState.direction,
      flowBiasStrength: this.flowBiasState.strength,
    };
  }

  /**
   * Reset burst manager to initial state
   */
  reset(): void {
    this.currentBurst = {
      direction: null,
      startTime: Date.now(),
      duration: 0,
      intensity: 1,
    };
    this.nextBurstTime = Date.now() + this.getRandomBurstGap();

    this.flowBiasState = {
      direction: null,
      startTime: Date.now(),
      duration: 0,
      strength: 0,
    };
    this.nextFlowBiasTime = Date.now() + this.getRandomFlowBiasGap();
  }
}

// ============================================
// UNIQUE ID GENERATOR
// ============================================

let vehicleIdCounter = 0;

export function generateVehicleId(): string {
  vehicleIdCounter += 1;
  return `vehicle-${vehicleIdCounter}-${Date.now()}`;
}

export function resetVehicleIdCounter(): void {
  vehicleIdCounter = 0;
}

// ============================================
// PLACEHOLDER FUNCTIONS FOR EXTERNAL LOGIC
// ============================================

/**
 * CORE LOGIC WILL BE CONNECTED HERE LATER
 * 
 * These placeholder functions return default values.
 * They are designed to be replaced with external logic.
 */

export function getRewardMetrics() {
  // CORE LOGIC WILL BE CONNECTED HERE LATER
  // This would compute reward based on waiting times, throughput, etc.
  return {
    waitingTime: 0,
    throughput: 0,
    queueLength: 0,
  };
}

/**
 * CORE LOGIC WILL BE CONNECTED HERE LATER
 * 
 * Placeholder for external vehicle position update logic.
 * Currently returns vehicles unchanged.
 */
export function updateVehiclePositionsExternal(vehicles: Vehicle[]): Vehicle[] {
  // CORE LOGIC WILL BE CONNECTED HERE LATER
  return vehicles;
}
