/**
 * Traffic Randomness Control Component
 * 
 * Controls the stochasticity of the traffic environment.
 * Higher randomness introduces greater variation in:
 * - Vehicle arrival timing from each direction
 * - Vehicle speeds
 * - Resulting queue buildup
 * - Resulting waiting times
 * 
 * This affects TRUE traffic dynamics, NOT sensor noise.
 */

import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Activity } from 'lucide-react';

interface TrafficRandomnessControlProps {
  randomness: number;
  onRandomnessChange: (randomness: number) => void;
  disabled?: boolean;
}

export function TrafficRandomnessControl({
  randomness,
  onRandomnessChange,
  disabled = false,
}: TrafficRandomnessControlProps) {
  const handleChange = (value: number[]) => {
    onRandomnessChange(value[0]);
  };

  const getLabel = (value: number): string => {
    if (value < 0.3) return 'Very Low';
    if (value < 0.5) return 'Low';
    if (value < 0.7) return 'Medium';
    if (value < 0.85) return 'High';
    return 'Very High';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-amber-500" />
        <Label className="text-sm font-semibold text-foreground">
          Traffic Randomness
        </Label>
      </div>
      
      <Slider
        value={[randomness]}
        onValueChange={handleChange}
        min={0}
        max={1}
        step={0.01}
        disabled={disabled}
        className="w-full"
      />
      
      <div className="flex justify-between items-center text-xs text-muted-foreground">
        <span>Deterministic</span>
        <span className="font-medium text-foreground">{getLabel(randomness)}</span>
        <span>Chaotic</span>
      </div>
      
      <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-1.5 rounded border border-border">
        <p>
          <strong>Effect:</strong> Varies arrival timing, vehicle speeds, and queue patterns for more realistic traffic behavior.
        </p>
      </div>
    </div>
  );
}
