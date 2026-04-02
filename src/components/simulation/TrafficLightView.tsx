/**
 * TrafficLightView Component
 * 
 * Renders a traffic light with red, yellow, and green indicators.
 * 
 * IMPORTANT: This component contains NO decision-making logic.
 * It simply displays the current light state passed via props.
 */

import React from 'react';
import { Direction, LightState } from '@/types/simulation';
import { cn } from '@/lib/utils';

interface TrafficLightViewProps {
  direction: Direction;
  state: LightState;
  elapsedTime?: number;
  showTimer?: boolean;
}

export function TrafficLightView({ direction, state, elapsedTime = 0, showTimer = false }: TrafficLightViewProps) {
  // Determine orientation based on direction
  const isVertical = direction === 'north' || direction === 'south';

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          "flex bg-slate-900 rounded-lg p-1.5 shadow-lg border border-slate-700",
          isVertical ? "flex-col gap-1" : "flex-row gap-1"
        )}
      >
        {/* Red light */}
        <div
          className={cn(
            "w-4 h-4 rounded-full transition-all duration-300",
            state === 'red'
              ? "bg-red-500 shadow-[0_0_10px_2px_rgba(239,68,68,0.7)]"
              : "bg-red-900/40"
          )}
        />

        {/* Yellow light */}
        <div
          className={cn(
            "w-4 h-4 rounded-full transition-all duration-300",
            state === 'yellow'
              ? "bg-yellow-400 shadow-[0_0_10px_2px_rgba(250,204,21,0.7)]"
              : "bg-yellow-900/40"
          )}
        />

        {/* Green light */}
        <div
          className={cn(
            "w-4 h-4 rounded-full transition-all duration-300",
            state === 'green'
              ? "bg-green-500 shadow-[0_0_10px_2px_rgba(34,197,94,0.7)]"
              : "bg-green-900/40"
          )}
        />
      </div>

      {/* Timer display */}
      {showTimer && (
        <div className="text-xs font-semibold text-white bg-slate-800 px-1.5 py-0.5 rounded border border-slate-600">
          {elapsedTime.toFixed(1)}s
        </div>
      )}
    </div>
  );
}
