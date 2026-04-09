/**
 * Traffic Signal Simulation - Vehicle Management Hook
 * 
 * This hook manages vehicle spawning, movement, and lifecycle.
 * 
 * IMPORTANT: Vehicle movement is purely visual/physics-based.
 * This hook contains NO decision-making logic for traffic control.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Vehicle,
  Direction,
  SimulationConfig,
  TrafficLightState,
  VehicleCounts,
} from '@/types/simulation';
import {
  generateRandomVehicleConfig,
  generateRandomVehicleConfigWithEnvironmentNoise,
  generateVehicleId,
  getSpawnPosition,
  getVehicleDimensions,
  shouldVehicleStop,
  hasVehiclePassedStopLine,
  isVehicleOffScreen,
  resetVehicleIdCounter,
} from '@/utils/simulationHelpers';
import { recordVehicleExit, resetMetrics } from '@/utils/metricsCalculator';

const CANVAS_SIZE = 600;
const DIRECTIONS: Direction[] = ['north', 'south', 'east', 'west'];

export interface UseVehiclesOptions {
  config: SimulationConfig;
  signalState: TrafficLightState;
  isRunning: boolean;
  virtualWidth?: number;
  virtualHeight?: number;
  onVehicleSpawned?: (direction: Direction) => void;
  onVehicleExited?: (direction: Direction) => void;
}

export function useVehicles(options: UseVehiclesOptions) {
  const { 
    config, 
    signalState, 
    isRunning, 
    virtualWidth = 600, 
    virtualHeight = 600,
    onVehicleSpawned, 
    onVehicleExited 
  } = options;

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const animationFrameRef = useRef<number>();
  const lastSpawnTimeRef = useRef<Record<Direction, number>>({
    north: 0,
    south: 0,
    east: 0,
    west: 0,
  });

  // ============================================
  // VEHICLE SPAWNING
  // ============================================

  const spawnVehicle = useCallback((direction: Direction) => {
    const numLanes = config.laneConfig[direction];
    const lane = Math.floor(Math.random() * numLanes);
    const vehicleConfig = generateRandomVehicleConfigWithEnvironmentNoise(config.environmentNoise.speedVariance);
    const position = getSpawnPosition(direction, lane, config, virtualWidth, virtualHeight);

    const now = Date.now();
    const newVehicle: Vehicle = {
      id: generateVehicleId(),
      direction,
      position,
      config: vehicleConfig,
      lane,
      stopped: false,
      throughIntersection: false,
      spawnTime: now,
      waitingStartTime: null,
    };

    setVehicles((prev) => [...prev, newVehicle]);

    if (onVehicleSpawned) {
      onVehicleSpawned(direction);
    }
  }, [config, onVehicleSpawned]);

  // ============================================
  // VEHICLE MOVEMENT
  // ============================================

  /**
   * CORE LOGIC WILL BE CONNECTED HERE LATER
   * 
   * This function updates vehicle positions based on simple physics.
   * It does NOT implement any intelligent traffic control.
   * Vehicles simply:
   * - Move forward at their speed
   * - Stop at red lights
   * - Continue through on green
   */
  const updateVehiclePositions = useCallback(() => {
    setVehicles((prevVehicles) => {
      const now = Date.now();
      const updatedVehicles: Vehicle[] = [];

      // Group vehicles by direction and lane to process them sequentially
      const laneGroups: Record<string, Vehicle[]> = {};
      prevVehicles.forEach((v) => {
        const key = `${v.direction}-${v.lane}`;
        if (!laneGroups[key]) laneGroups[key] = [];
        laneGroups[key].push(v);
      });

      // Process each lane independently
      for (const laneKey in laneGroups) {
        const vehiclesInLane = laneGroups[laneKey];
        const [direction] = laneKey.split('-') as [Direction];

        // Sort vehicles from front (closest to/past intersection) to back
        // north: travels south (y+), front has larger y
        // south: travels north (y-), front has smaller y
        // east: travels west (x-), front has smaller x
        // west: travels east (x+), front has larger x
        vehiclesInLane.sort((a, b) => {
          switch (direction) {
            case 'north': return b.position.y - a.position.y;
            case 'south': return a.position.y - b.position.y;
            case 'east': return a.position.x - b.position.x;
            case 'west': return b.position.x - a.position.x;
            default: return 0;
          }
        });

        let frontVehicleInLane: Vehicle | null = null;

        for (const vehicle of vehiclesInLane) {
          // Check if vehicle should be removed
          if (isVehicleOffScreen(vehicle, virtualWidth, virtualHeight)) {
            // Record exit for flow rate calculation
            recordVehicleExit(vehicle.direction, vehicle.lane);
            if (onVehicleExited) {
              onVehicleExited(vehicle.direction);
            }
            continue;
          }

          // 1. Initial stop decision based on traffic light
          let shouldStop = shouldVehicleStop(vehicle, signalState, config, 600);

          // 2. Queuing logic: Stop if too close to the vehicle in front
          if (!shouldStop && frontVehicleInLane) {
            const dims = getVehicleDimensions(vehicle.config.size);
            const frontDims = getVehicleDimensions(frontVehicleInLane.config.size);
            const safeGap = 15; // Minimum gap between bumpers

            // Distance required between centers to maintain safe gap
            const minCenterDist = (dims.height + frontDims.height) / 2 + safeGap;

            // Current distance between centers depends on direction
            let currentDist = 1000;
            switch (direction) {
              case 'north': currentDist = frontVehicleInLane.position.y - vehicle.position.y; break;
              case 'south': currentDist = vehicle.position.y - frontVehicleInLane.position.y; break;
              case 'east': currentDist = vehicle.position.x - frontVehicleInLane.position.x; break;
              case 'west': currentDist = frontVehicleInLane.position.x - vehicle.position.x; break;
            }

            // Stop if too close to a vehicle that is already stopped or slow
            // BUT only if we haven't both passed the intersection (don't stack inside intersection)
            // Or if the front vehicle is not moving, we must stop regardless.
            if (currentDist < minCenterDist) {
              // If the front vehicle is stopped, this vehicle MUST stop
              if (frontVehicleInLane.stopped) {
                shouldStop = true;
              }
              // If we are both before the intersection and getting too close, stop to form queue
              else if (!vehicle.throughIntersection && !frontVehicleInLane.throughIntersection) {
                // If front vehicle is slower or at a distance that justifies stopping
                // we treat it as an extension of the stop line
                if (currentDist < minCenterDist * 0.9) {
                  shouldStop = true;
                }
              }
            }
          }

          // Track waiting time
          let waitingStartTime = vehicle.waitingStartTime;
          if (shouldStop && !vehicle.throughIntersection && waitingStartTime === null) {
            waitingStartTime = now;
          } else if (!shouldStop || vehicle.throughIntersection) {
            waitingStartTime = null;
          }

          // Calculate new position
          let newPosition = { ...vehicle.position };

          if (!shouldStop) {
            const speed = vehicle.config.speed;
            switch (direction) {
              case 'north': newPosition.y += speed; break;
              case 'south': newPosition.y -= speed; break;
              case 'east': newPosition.x -= speed; break;
              case 'west': newPosition.x += speed; break;
            }
          }

          // 3. Hard non-overlap enforcement within a lane:
          // clamp the follower so it never crosses into the front vehicle's space.
          if (frontVehicleInLane) {
            const dims = getVehicleDimensions(vehicle.config.size);
            const frontDims = getVehicleDimensions(frontVehicleInLane.config.size);
            const safeGap = 15;
            const minCenterDist = (dims.height + frontDims.height) / 2 + safeGap;

            switch (direction) {
              case 'north': {
                const maxY = frontVehicleInLane.position.y - minCenterDist;
                if (newPosition.y > maxY) {
                  newPosition.y = maxY;
                  shouldStop = true;
                }
                break;
              }
              case 'south': {
                const minY = frontVehicleInLane.position.y + minCenterDist;
                if (newPosition.y < minY) {
                  newPosition.y = minY;
                  shouldStop = true;
                }
                break;
              }
              case 'east': {
                const minX = frontVehicleInLane.position.x + minCenterDist;
                if (newPosition.x < minX) {
                  newPosition.x = minX;
                  shouldStop = true;
                }
                break;
              }
              case 'west': {
                const maxX = frontVehicleInLane.position.x - minCenterDist;
                if (newPosition.x > maxX) {
                  newPosition.x = maxX;
                  shouldStop = true;
                }
                break;
              }
            }
          }

          // Check if vehicle has passed stop line (entering intersection)
          const passedStopLine = hasVehiclePassedStopLine(vehicle, config, 600);

          const updatedVehicle: Vehicle = {
            ...vehicle,
            position: newPosition,
            stopped: shouldStop,
            throughIntersection: passedStopLine || vehicle.throughIntersection,
            waitingStartTime,
          };

          updatedVehicles.push(updatedVehicle);
          frontVehicleInLane = updatedVehicle;
        }
      }

      return updatedVehicles;
    });
  }, [signalState, config, onVehicleExited]);

  // ============================================
  // SPAWNING LOGIC
  // ============================================

  const trySpawnVehicles = useCallback(() => {
    const now = Date.now();
    const spawnInterval = 1000 / config.spawnRate; // ms between spawns

    // Apply environment spawn jitter (0-1)
    // Adds gentle wave-like variation in inter-arrival time: ±10-20% of spawn interval
    const jitterAmount = spawnInterval * (config.environmentNoise.spawnJitter * 1.5);

    DIRECTIONS.forEach((direction) => {
      const lastSpawn = lastSpawnTimeRef.current[direction];
      const jitter = (Math.random() - 0.5) * jitterAmount;

      if (now - lastSpawn >= spawnInterval + jitter) {
        // Base probability influenced by overall traffic randomness
        let spawnProbability = 0.65 + config.trafficRandomness * 0.3;

        // Apply directional bias from environment noise
        // Realistic: ±25% max probability swing
        const isNS = direction === 'north' || direction === 'south';
        const biasFactor = isNS ? config.environmentNoise.directionalBias : -config.environmentNoise.directionalBias;
        const biasMultiplier = 1 + (biasFactor * 0.25); // max ±25%
        spawnProbability = Math.max(0.3, Math.min(0.95, spawnProbability * biasMultiplier));

        // Apply direction-specific burst intensity
        // Realistic: at most +20% probability during a burst
        if (config.trafficBurstState) {
          const directionIntensity = config.trafficBurstState.directionIntensities[direction];
          // directionIntensity is 0-2; clamp boost to 20% max
          const intensityBoost = Math.min(0.2, (directionIntensity - 1.0) * 0.2);
          spawnProbability = Math.min(0.95, spawnProbability + intensityBoost);
        }

        if (Math.random() < spawnProbability) {
          spawnVehicle(direction);
        }
        lastSpawnTimeRef.current[direction] = now;
      }
    });
  }, [config.spawnRate, config.trafficRandomness, config.environmentNoise, config.trafficBurstState, spawnVehicle]);

  // ============================================
  // ANIMATION LOOP
  // ============================================

  useEffect(() => {
    if (!isRunning) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const animate = () => {
      updateVehiclePositions();
      trySpawnVehicles();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRunning, updateVehiclePositions, trySpawnVehicles]);

  // ============================================
  // RESET
  // ============================================

  const resetVehicles = useCallback(() => {
    setVehicles([]);
    resetVehicleIdCounter();
    resetMetrics();
    lastSpawnTimeRef.current = {
      north: 0,
      south: 0,
      east: 0,
      west: 0,
    };
  }, []);

  return {
    vehicles,
    resetVehicles,
    spawnVehicle,
  };
}
