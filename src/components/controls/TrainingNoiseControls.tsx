/**
 * SensorNoiseControls Component
 * 
 * UI controls for configuring probabilistic sensor noise parameters.
 * Allows users to adjust noise levels for queue length, waiting time,
 * and average speed metrics to simulate sensor uncertainty.
 * 
 * IMPORTANT: This component only controls noise parameters.
 * It does not contain any decision-making or learning logic.
 */

import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { TrainingNoiseConfig } from '@/corelogic/probabilisticSensorModel';
import { Separator } from '@/components/ui/separator';

interface TrainingNoiseControlsProps {
  trainingNoiseConfig: TrainingNoiseConfig;
  onChange: (config: TrainingNoiseConfig) => void;
}

export function TrainingNoiseControls({
  trainingNoiseConfig,
  onChange,
}: TrainingNoiseControlsProps) {
  const handleQueueLengthNoiseChange = (value: number) => {
    onChange({
      ...trainingNoiseConfig,
      queueLengthNoise: value,
    });
  };

  const handleAvgWaitingTimeNoiseChange = (value: number) => {
    onChange({
      ...trainingNoiseConfig,
      avgWaitingTimeNoise: value,
    });
  };

  const handleAvgSpeedNoiseChange = (value: number) => {
    onChange({
      ...trainingNoiseConfig,
      avgSpeedNoise: value,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-sm font-medium text-foreground">
          Training Noise Configuration
        </Label>
        <p className="text-xs text-muted-foreground">
          Configure probability distributions for sensor observations. Discrete metrics use discrete distributions; continuous metrics use normal distributions.
        </p>
      </div>

      <Separator />

      {/* Queue Length Noise */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Label className="text-sm font-medium text-foreground">
            Queue Length Noise (k)
          </Label>
          <span className="text-sm font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
            ±{Math.round(trainingNoiseConfig.queueLengthNoise)} vehicles
          </span>
        </div>
        
        <Slider
          value={[trainingNoiseConfig.queueLengthNoise]}
          onValueChange={(values) => handleQueueLengthNoiseChange(Math.round(values[0]))}
          min={0}
          max={10}
          step={1}
          className="w-full"
        />
        
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0</span>
          <span>10</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Discrete distribution over [v-{Math.round(trainingNoiseConfig.queueLengthNoise)}, ..., v+{Math.round(trainingNoiseConfig.queueLengthNoise)}]
        </p>
      </div>

      {/* Average Waiting Time Noise */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Label className="text-sm font-medium text-foreground">
            Waiting Time Noise
          </Label>
          <span className="text-sm font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
            {(trainingNoiseConfig.avgWaitingTimeNoise * 100).toFixed(0)}%
          </span>
        </div>
        
        <Slider
          value={[trainingNoiseConfig.avgWaitingTimeNoise]}
          onValueChange={(values) => handleAvgWaitingTimeNoiseChange(values[0])}
          min={0}
          max={0.5}
          step={0.01}
          className="w-full"
        />
        
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0%</span>
          <span>50%</span>
        </div>
      </div>

      {/* Average Speed Noise */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Label className="text-sm font-medium text-foreground">
            Average Speed Noise
          </Label>
          <span className="text-sm font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
            {(trainingNoiseConfig.avgSpeedNoise * 100).toFixed(0)}%
          </span>
        </div>
        
        <Slider
          value={[trainingNoiseConfig.avgSpeedNoise]}
          onValueChange={(values) => handleAvgSpeedNoiseChange(values[0])}
          min={0}
          max={0.5}
          step={0.01}
          className="w-full"
        />
        
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0%</span>
          <span>50%</span>
        </div>
      </div>
    </div>
  );
}
