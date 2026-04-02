/**
 * Traffic Signal Simulation - Type Definitions
 * 
 * This file contains all TypeScript interfaces and types for the
 * traffic simulation UI shell. These types are designed to be
 * extensible for future integration with external control logic.
 */

// ============================================
// DIRECTION & POSITION TYPES
// ============================================

export type Direction = 'north' | 'south' | 'east' | 'west';

export type SignalDirection = 'NS' | 'EW';

export interface Position {
  x: number;
  y: number;
}

// ============================================
// TRAFFIC LIGHT TYPES
// ============================================

export type LightState = 'red' | 'yellow' | 'green';

export interface TrafficLightState {
  NS: LightState; // North-South direction
  EW: LightState; // East-West direction
}

export interface TrafficLight {
  direction: Direction;
  state: LightState;
  position: Position;
}

// ============================================
// VEHICLE TYPES
// ============================================

export type VehicleSize = 'small' | 'medium' | 'large';

export interface VehicleConfig {
  size: VehicleSize;
  color: string;
  speed: number; // pixels per frame
}

export interface Vehicle {
  id: string;
  direction: Direction;
  position: Position;
  config: VehicleConfig;
  lane: number; // 0 or 1 for two-lane config
  stopped: boolean;
  throughIntersection: boolean; // Has passed stop line
  spawnTime: number; // Timestamp when vehicle was spawned
  waitingStartTime: number | null; // Timestamp when vehicle started waiting (null if not waiting)
}

// ============================================
// SIMULATION STATE TYPES
// ============================================

export interface LaneConfig {
  north: 1 | 2;
  south: 1 | 2;
  east: 1 | 2;
  west: 1 | 2;
}

/**
 * Tracks direction-specific traffic intensity and burst patterns
 * Also tracks flow bias for directional preference
 */
export interface TrafficBurstState {
  activeBurstDirection: Direction | null; // Current burst direction
  burstIntensity: number; // 1.2-2.5 intensity multiplier
  timeRemainingInBurst: number; // milliseconds
  timeUntilNextBurst: number; // milliseconds
  directionIntensities: Record<Direction, number>; // 0.5-2.5 per direction
  flowBiasDirection: SignalDirection | null; // NS or EW gets flow preference, or null
  flowBiasStrength: number; // 0-1 strength of the bias (30-80% stronger arrivals)
}

export interface SimulationConfig {
  spawnRate: number; // vehicles per second (0.1 - 5)
  laneConfig: LaneConfig;
  intersectionSize: number; // pixels
  roadWidth: number; // pixels per lane
  trafficRandomness: number; // 0 (deterministic) to 1 (chaotic)
  trafficBurstState?: TrafficBurstState; // Direction-specific traffic patterns
}

export interface VehicleCounts {
  north: number;
  south: number;
  east: number;
  west: number;
}

// ============================================
// METRICS TYPES
// ============================================

export interface LaneMetrics {
  queueLength: number; // Number of vehicles waiting in this lane
  avgWaitingTime: number; // Average waiting time in seconds
  maxWaitingTime: number; // Maximum waiting time in seconds
  flowRate: number; // Vehicles per minute
  avgSpeed: number; // Average speed (pixels per frame)
  avgDelay: number; // Average delay compared to free-flow speed (percentage)
}

export interface DirectionMetrics {
  [key: string]: LaneMetrics; // Key is direction-lane (e.g., "north-0", "north-1")
}

export interface SimulationMetrics {
  laneMetrics: DirectionMetrics;
  timeSinceLastSignalChange: number; // Seconds since last signal change
  totalFlowRate: number; // Total vehicles per minute across all directions
}

export interface SimulationState {
  isRunning: boolean;
  vehicles: Vehicle[];
  signalState: TrafficLightState;
  vehicleCounts: VehicleCounts;
  config: SimulationConfig;
}

// ============================================
// CALLBACK & HANDLER TYPES
// ============================================

/**
 * CORE LOGIC WILL BE CONNECTED HERE LATER
 * 
 * These callback types are designed to allow external systems
 * to hook into the simulation for:
 * - Reinforcement learning agents
 * - Probabilistic sensor models
 * - Reward computation
 * - Multi-agent coordination
 */

export interface SimulationCallbacks {
  /**
   * Called when signal state changes
   * CORE LOGIC WILL BE CONNECTED HERE LATER
   */
  onSignalChange?: (newState: TrafficLightState) => void;

  /**
   * Called each simulation tick with current state
   * CORE LOGIC WILL BE CONNECTED HERE LATER
   */
  onTick?: (state: SimulationState) => void;

  /**
   * Called when a vehicle enters the intersection
   * CORE LOGIC WILL BE CONNECTED HERE LATER
   */
  onVehicleEnter?: (vehicle: Vehicle) => void;

  /**
   * Called when a vehicle exits the intersection
   * CORE LOGIC WILL BE CONNECTED HERE LATER
   */
  onVehicleExit?: (vehicle: Vehicle) => void;
}

// ============================================
// PLACEHOLDER FUNCTION TYPES
// ============================================

/**
 * Placeholder function signatures for future external logic integration
 * CORE LOGIC WILL BE CONNECTED HERE LATER
 */

export type GetSignalStateFunction = () => TrafficLightState;
export type SetSignalStateFunction = (state: TrafficLightState) => void;
export type UpdateVehiclePositionsFunction = (vehicles: Vehicle[]) => Vehicle[];
export type GetRewardMetricsFunction = () => {
  waitingTime: number;
  throughput: number;
  queueLength: number;
};

// ============================================
// COMPONENT PROP TYPES
// ============================================

export interface IntersectionViewProps {
  vehicles: Vehicle[];
  signalState: TrafficLightState;
  config: SimulationConfig;
}

export interface TrafficLightViewProps {
  direction: Direction;
  state: LightState;
  position: Position;
}

export interface VehicleViewProps {
  vehicle: Vehicle;
  config: SimulationConfig;
}

export interface ControlPanelProps {
  state: SimulationState;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSignalChange: (direction: SignalDirection) => void;
  onSpawnRateChange: (rate: number) => void;
  onLaneConfigChange: (config: LaneConfig) => void;
}
