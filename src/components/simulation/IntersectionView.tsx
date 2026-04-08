/**
 * IntersectionView Component
 * 
 * Main component that renders the complete intersection view including:
 * - Road infrastructure
 * - Traffic lights
 * - Vehicles
 * 
 * IMPORTANT: This component contains NO decision-making logic.
 * It is purely a visualization layer.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Vehicle,
  SimulationConfig,
  TrafficLightState,
} from '@/types/simulation';
import { RoadView } from './RoadView';
import { VehicleView } from './VehicleView';
import { TrafficLightView } from './TrafficLightView';

interface IntersectionViewProps {
  vehicles: Vehicle[];
  signalState: TrafficLightState;
  config: SimulationConfig;
  elapsedTimeSeconds?: number;
  agentEnabled?: boolean;
  virtualWidth?: number;
  virtualHeight?: number;
}

const CANVAS_SIZE = 600;

export function IntersectionView({
  vehicles,
  signalState,
  config,
  elapsedTimeSeconds = 0,
  agentEnabled = false,
  virtualWidth = 600,
  virtualHeight = 600,
}: IntersectionViewProps) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const { roadWidth, laneConfig } = config;

  // Handle responsiveness via dimension tracking
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(containerRef.current);

    // Initial call
    updateDimensions();

    return () => resizeObserver.disconnect();
  }, []);

  // Calculate road widths
  const nsLanes = Math.max(laneConfig.north, laneConfig.south);
  const ewLanes = Math.max(laneConfig.east, laneConfig.west);

  // NS road width set by request to match EW width in UI
  const nsRoadWidth = ewLanes * roadWidth * 2;
  const ewRoadWidth = ewLanes * roadWidth * 2;

  // world base widths in simulation coords (600x600)
  const nsWorldRoadWidth = nsLanes * roadWidth * 2;
  const ewWorldRoadWidth = ewLanes * roadWidth * 2;

  // Traffic light positions (at corners of intersection)
  const lightOffset = 30;
  const centerX = dimensions.width / 2;
  const centerY = dimensions.height / 2;

  // World scaling from internal 600x600 sim coordinates to actual container
  const worldScaleX = dimensions.width / 600;
  const worldScaleY = dimensions.height / 600;

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center bg-muted/20 relative overflow-hidden"
    >
      {dimensions.width > 0 && dimensions.height > 0 && (
        <div
          className="relative w-full h-full"
        >
          {/* Road infrastructure (scaled to container) */}
          <RoadView
            config={config}
            width={dimensions.width}
            height={dimensions.height}
          />

          {/* Vehicles - map internal simulation coordinates to actual container dimensions */}
          {vehicles.map((vehicle) => {
            // Use unified scale (pixels per sim unit) for both directions
            // We use the pixel height as the baseline since virtualHeight is fixed at 600
            const unifiedScale = dimensions.height / virtualHeight;
            
            // Re-calculate mapping to be center-relative and uniform
            // Simulation center is always 300, 300
            const position = {
              x: centerX + (vehicle.position.x - 300) * unifiedScale,
              y: centerY + (vehicle.position.y - 300) * unifiedScale,
            };

            return (
              <VehicleView
                key={vehicle.id}
                vehicle={{
                  ...vehicle,
                  position,
                }}
              />
            );
          })}

          {/* Traffic Lights - Symmetrically placed at corners - Rendered after vehicles for top-layer visibility */}
          {/* North-West (controls southbound / westbound) */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
            style={{
              left: centerX - nsRoadWidth / 2 - lightOffset,
              top: centerY - ewRoadWidth / 2 - lightOffset,
            }}
          >
            <TrafficLightView
              direction="south"
              state={signalState.NS}
              elapsedTime={elapsedTimeSeconds}
              showTimer={agentEnabled}
            />
          </div>

          {/* North-East (controls southbound / eastbound) */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
            style={{
              left: centerX + nsRoadWidth / 2 + lightOffset,
              top: centerY - ewRoadWidth / 2 - lightOffset,
            }}
          >
            <TrafficLightView
              direction="west"
              state={signalState.EW}
              elapsedTime={elapsedTimeSeconds}
              showTimer={agentEnabled}
            />
          </div>

          {/* South-East (controls northbound / eastbound) */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
            style={{
              left: centerX + nsRoadWidth / 2 + lightOffset,
              top: centerY + ewRoadWidth / 2 + lightOffset,
            }}
          >
            <TrafficLightView
              direction="north"
              state={signalState.NS}
              elapsedTime={elapsedTimeSeconds}
              showTimer={agentEnabled}
            />
          </div>

          {/* South-West (controls northbound / westbound) */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
            style={{
              left: centerX - nsRoadWidth / 2 - lightOffset,
              top: centerY + ewRoadWidth / 2 + lightOffset,
            }}
          >
            <TrafficLightView
              direction="east"
              state={signalState.EW}
              elapsedTime={elapsedTimeSeconds}
              showTimer={agentEnabled}
            />
          </div>

          {/* Direction labels */}
          <div className="absolute top-24 left-1/2 -translate-x-1/2 text-xs font-bold text-foreground/40 bg-background/20 px-2 py-0.5 rounded border border-foreground/10 uppercase tracking-widest">
            North
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs font-bold text-foreground/40 bg-background/20 px-2 py-0.5 rounded border border-foreground/10 uppercase tracking-widest">
            South
          </div>
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-foreground/40 bg-background/20 px-2 py-0.5 rounded border border-foreground/10 uppercase tracking-widest [writing-mode:vertical-rl] rotate-180">
            West
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-foreground/40 bg-background/20 px-2 py-0.5 rounded border border-foreground/10 uppercase tracking-widest [writing-mode:vertical-rl]">
            East
          </div>
        </div>
      )}
    </div>
  );
}
