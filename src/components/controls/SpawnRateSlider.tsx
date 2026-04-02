/**
 * SpawnRateSlider Component
 * 
 * Slider control to adjust vehicle spawn rate.
 * 
 * IMPORTANT: This is a manual control only.
 * The spawn rate affects visual vehicle generation,
 * not any traffic control logic.
 */

import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

interface SpawnRateSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export function SpawnRateSlider({ value, onChange }: SpawnRateSliderProps) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Label className="text-sm font-medium text-foreground">
          Vehicle Spawn Rate
        </Label>
        <span className="text-sm font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
          {value.toFixed(1)}/s
        </span>
      </div>
      
      <Slider
        value={[value]}
        onValueChange={(values) => onChange(values[0])}
        min={0.2}
        max={3}
        step={0.1}
        className="w-full"
      />
      
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Slow</span>
        <span>Fast</span>
      </div>
    </div>
  );
}
