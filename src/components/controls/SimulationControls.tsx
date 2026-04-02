/**
 * SimulationControls Component
 * 
 * Provides Start, Pause, and Reset buttons for the simulation.
 * 
 * IMPORTANT: These are manual controls only.
 * No automated behavior is implemented here.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface SimulationControlsProps {
  isRunning: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
}

export function SimulationControls({
  isRunning,
  onStart,
  onPause,
  onReset,
}: SimulationControlsProps) {
  return (
    <div className="flex gap-2">
      {isRunning ? (
        <Button
          onClick={onPause}
          variant="secondary"
          className="flex-1"
        >
          <Pause className="w-4 h-4 mr-2" />
          Pause
        </Button>
      ) : (
        <Button
          onClick={onStart}
          className="flex-1"
        >
          <Play className="w-4 h-4 mr-2" />
          Start
        </Button>
      )}
      
      <Button
        onClick={onReset}
        variant="outline"
      >
        <RotateCcw className="w-4 h-4" />
      </Button>
    </div>
  );
}
