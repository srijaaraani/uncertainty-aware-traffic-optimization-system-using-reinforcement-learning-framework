/**
 * VehicleView Component
 * 
 * Renders a single vehicle as a simple colored rectangle.
 * Vehicle appearance varies by size and color.
 * 
 * IMPORTANT: This component contains NO decision-making logic.
 * It simply renders the vehicle at its current position.
 */

import React from 'react';
import { Vehicle, SimulationConfig } from '@/types/simulation';
import { getVehicleDimensions } from '@/utils/simulationHelpers';

interface VehicleViewProps {
  vehicle: Vehicle;
}

function VehicleViewComponent({ vehicle }: VehicleViewProps) {
  const { position, direction, config, stopped } = vehicle;
  const dimensions = getVehicleDimensions(config.size);

  // Calculate rotation based on direction
  const getRotation = () => {
    switch (direction) {
      case 'north':
        return 180;
      case 'south':
        return 0;
      case 'east':
        return 90;
      case 'west':
        return -90;
    }
  };

  // Swap width/height for horizontal movement
  const isHorizontal = direction === 'east' || direction === 'west';
  const width = isHorizontal ? dimensions.height : dimensions.width;
  const height = isHorizontal ? dimensions.width : dimensions.height;

  const translateX = position.x - width / 2;
  const translateY = position.y - height / 2;

  return (
    <div
      className="absolute transition-opacity duration-150 will-change-transform"
      style={{
        width,
        height,
        transform: `translate3d(${translateX}px, ${translateY}px, 0) rotate(${getRotation()}deg)`,
      }}
    >
      {/* Vehicle body */}
      <div
        className="w-full h-full rounded-sm shadow-md"
        style={{
          backgroundColor: config.color,
          opacity: stopped ? 0.9 : 1,
        }}
      >
        {/* Windshield */}
        <div
          className="absolute top-1 left-1/2 -translate-x-1/2 bg-sky-200/60 rounded-sm"
          style={{
            width: width * 0.6,
            height: height * 0.2,
          }}
        />

        {/* Headlights */}
        <div
          className="absolute bottom-1 left-1 w-1.5 h-1 bg-yellow-200 rounded-full"
          style={{ opacity: 0.8 }}
        />
        <div
          className="absolute bottom-1 right-1 w-1.5 h-1 bg-yellow-200 rounded-full"
          style={{ opacity: 0.8 }}
        />

        {/* Brake lights (show when stopped) */}
        {stopped && (
          <>
            <div
              className="absolute top-1 left-1 w-1.5 h-1 bg-red-500 rounded-full animate-pulse"
            />
            <div
              className="absolute top-1 right-1 w-1.5 h-1 bg-red-500 rounded-full animate-pulse"
            />
          </>
        )}
      </div>
    </div>
  );
}

export const VehicleView = React.memo(VehicleViewComponent);
