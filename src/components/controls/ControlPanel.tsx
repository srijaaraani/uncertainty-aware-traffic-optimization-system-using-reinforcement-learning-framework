/**
 * ControlPanel Component
 * 
 * Main control panel that combines all control components.
 * 
 * IMPORTANT: All controls are manual.
 * No automated decision-making logic is implemented here.
 */

import React, { useState } from 'react';
import {
  SimulationState,
  SignalDirection,
  LaneConfig,
} from '@/types/simulation';
import { SimulationControls } from './SimulationControls';
import { SignalOverride } from './SignalOverride';
import { TrafficRandomnessControl } from './TrafficRandomnessControl';
import { TrafficPatternDisplay } from './TrafficPatternDisplay';
import { LaneConfigToggle } from './LaneConfigToggle';
import { VehicleCounters } from './VehicleCounters';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Activity, Zap } from 'lucide-react';
import { SensorNoiseConfig } from '@/corelogic/probabilisticSensorModel';
import { TrainingMetrics } from '@/corelogic/dqnAgent';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface ControlPanelProps {
  isRunning: boolean;
  signalState: SimulationState['signalState'];
  vehicleCounts: SimulationState['vehicleCounts'];
  config: SimulationState['config'];
  noiseConfig: SensorNoiseConfig;
  noiseEnabled: boolean;
  agentEnabled: boolean;
  dqnMode?: boolean;
  dqnMetrics?: TrainingMetrics | null;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSignalChange: (direction: SignalDirection) => void;
  onTrafficRandomnessChange: (randomness: number) => void;
  onLaneConfigChange: (config: LaneConfig) => void;
  onNoiseConfigChange: (config: SensorNoiseConfig) => void;
  onNoiseEnabledChange: (enabled: boolean) => void;
  onAgentEnabledChange: (enabled: boolean) => void;
  onDqnModeChange?: (enabled: boolean) => void;
}

export function ControlPanel({
  isRunning,
  signalState,
  vehicleCounts,
  config,
  noiseConfig,
  noiseEnabled,
  agentEnabled,
  dqnMode = false,
  dqnMetrics = null,
  onStart,
  onPause,
  onReset,
  onSignalChange,
  onTrafficRandomnessChange,
  onLaneConfigChange,
  onNoiseConfigChange,
  onNoiseEnabledChange,
  onAgentEnabledChange,
  onDqnModeChange,
}: ControlPanelProps) {
  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Settings className="w-5 h-5" />
          Control Panel
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`}
          />
          <span className="text-sm text-gray-600">
            {isRunning ? 'Simulation Running' : 'Simulation Paused'}
          </span>
        </div>

        {/* Simulation Controls */}
        <SimulationControls
          isRunning={isRunning}
          onStart={onStart}
          onPause={onPause}
          onReset={onReset}
        />

        <Separator />

        {/* Automatic Agent Control */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-600" />
              <Label className="text-sm font-semibold text-foreground">
                Automatic Agent Control
              </Label>
            </div>
            <Switch
              checked={agentEnabled}
              onCheckedChange={onAgentEnabledChange}
            />
          </div>

          {agentEnabled && (
            <div className="ml-6 space-y-2 pt-2 border-l-2 border-purple-300 pl-3">
              {/* DQN Mode Toggle */}
              {onDqnModeChange && (
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    DQN Learning Mode
                  </Label>
                  <Switch
                    checked={dqnMode}
                    onCheckedChange={onDqnModeChange}
                    disabled={!agentEnabled}
                  />
                </div>
              )}

              <div className="text-xs text-purple-700 bg-purple-50 p-2 rounded border border-purple-200">
                <p>
                  <strong>{dqnMode ? 'DQN Agent Active' : 'Rule-Based Agent Active'}</strong><br />
                  • Observes: Noisy queue length & waiting time<br />
                  • Decides: Which direction gets green<br />
                  {dqnMode ? (
                    <>
                      • Policy: Deep Q-Network (learning)<br />
                      • Training: Experience replay + target network
                    </>
                  ) : (
                    <>
                      • Policy: Give green to more congested direction<br />
                      • Manual signal control is disabled
                    </>
                  )}
                </p>
              </div>

              {/* DQN Metrics Display */}
              {dqnMode && dqnMetrics && (
                <div className="text-xs bg-indigo-50 p-2 rounded border border-indigo-200 space-y-1">
                  <div className="font-semibold text-indigo-900 mb-1">Learning Metrics:</div>
                  <div className="grid grid-cols-2 gap-1 text-indigo-700">
                    <span>Epsilon (ε):</span>
                    <span className="font-mono">{dqnMetrics.epsilon.toFixed(3)}</span>
                    <span>Training Steps:</span>
                    <span className="font-mono">{dqnMetrics.trainingSteps}</span>
                    <span>Experiences:</span>
                    <span className="font-mono">{dqnMetrics.experienceCount}</span>
                    <span>Loss:</span>
                    <span className="font-mono">{dqnMetrics.loss.toFixed(4)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {!agentEnabled && (
            <p className="text-xs text-muted-foreground ml-6 text-gray-500 italic">
              Manual signal control is active
            </p>
          )}
        </div>

        <Separator />

        {/* Signal Override */}
        <SignalOverride
          signalState={signalState}
          onSignalChange={onSignalChange}
          disabled={agentEnabled}
        />

        <Separator />

        {/* Traffic Randomness */}
        <TrafficRandomnessControl
          randomness={config.trafficRandomness}
          onRandomnessChange={onTrafficRandomnessChange}
        />

        {/* Sensor Noise / Uncertainty Configuration */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-600" />
              <Label className="text-sm font-semibold text-foreground">
                Sensor Noise / Uncertainty
              </Label>
            </div>
            <Switch
              checked={noiseEnabled}
              onCheckedChange={onNoiseEnabledChange}
            />
          </div>

          {noiseEnabled && (
            <div className="ml-6 space-y-4 pt-2 border-l-2 border-blue-300 pl-3">
              {/* Queue Length Noise */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Queue Length Noise
                  </Label>
                  <span className="text-xs font-mono bg-blue-50 px-2 py-0.5 rounded text-blue-700">
                    ±{Math.round(noiseConfig.queueLengthNoise)} vehicles
                  </span>
                </div>

                <Slider
                  value={[noiseConfig.queueLengthNoise]}
                  onValueChange={(values) => {
                    onNoiseConfigChange({
                      ...noiseConfig,
                      queueLengthNoise: Math.round(values[0]),
                    });
                  }}
                  min={0}
                  max={10}
                  step={1}
                  className="w-full"
                />

                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0</span>
                  <span>10</span>
                </div>
              </div>

              {/* Average Waiting Time Noise */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Waiting Time Noise
                  </Label>
                  <span className="text-xs font-mono bg-blue-50 px-2 py-0.5 rounded text-blue-700">
                    {(noiseConfig.avgWaitingTimeNoise * 100).toFixed(0)}%
                  </span>
                </div>

                <Slider
                  value={[noiseConfig.avgWaitingTimeNoise]}
                  onValueChange={(values) => {
                    onNoiseConfigChange({
                      ...noiseConfig,
                      avgWaitingTimeNoise: values[0],
                    });
                  }}
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

              {/* Note about uncertainty */}
              <div className="text-xs text-blue-700 bg-blue-50 p-2 rounded border border-blue-200 mt-2">
                <p>
                  <strong>Queue Length:</strong> Discrete distribution [v±k]<br />
                  <strong>Waiting Time:</strong> Normal distribution with σ = value × noise%
                </p>
              </div>
            </div>
          )}

          {!noiseEnabled && (
            <p className="text-xs text-muted-foreground ml-6 text-gray-500 italic">
              Sensor noise is disabled — using true values
            </p>
          )}
        </div>

        {/* Traffic Pattern Display */}
        <TrafficPatternDisplay burstState={config.trafficBurstState} />

        {/* Lane Configuration */}
        <LaneConfigToggle
          config={config.laneConfig}
          onChange={onLaneConfigChange}
        />

        <Separator />

        {/* Vehicle Counters */}
        <VehicleCounters counts={vehicleCounts} />

        <Separator />

        {/* Learning Note */}
        <div className="mt-4 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
          <p className="text-xs text-indigo-800">
            <strong>Deep Q-Network Active:</strong> The agent learns an optimal policy by trial and error using the multi-objective reward function.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
