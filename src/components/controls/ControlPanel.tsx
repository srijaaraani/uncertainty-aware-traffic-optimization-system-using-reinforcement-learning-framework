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
} from '@/types/simulation';
import { TrafficPatternDisplay } from './TrafficPatternDisplay';
import { LaneConfigToggle } from './LaneConfigToggle';
import { VehicleCounters } from './VehicleCounters';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Activity, Zap, Cpu } from 'lucide-react';
import { SensorNoiseConfig } from '@/corelogic/probabilisticSensorModel';
import { TrainingMetrics } from '@/corelogic/dqnAgent';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

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
          Simulation Metrics
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                }`}
            />
            <span className="text-sm font-medium text-slate-700">
              {isRunning ? 'System Online' : 'System Standby'}
            </span>
          </div>
          <Badge variant={isRunning ? "default" : "secondary"} className={isRunning ? "bg-green-100 text-green-700 border-green-200" : ""}>
            {isRunning ? 'RUNNING' : 'PAUSED'}
          </Badge>
        </div>

        <Separator />

        {/* Telemetry Summary Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {/* Row 1: Headings */}
          <div className="grid grid-cols-3 bg-slate-50/80 border-b border-slate-200">
            <div className="p-2.5 text-center flex items-center justify-center gap-1.5 border-r border-slate-200">
              <Activity className="w-3.5 h-3.5 text-purple-600" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Agent Status</span>
            </div>
            <div className="p-2.5 text-center flex items-center justify-center gap-1.5 border-r border-slate-200">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Traffic Dynamics</span>
            </div>
            <div className="p-2.5 text-center flex items-center justify-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sensor Uncertainty</span>
            </div>
          </div>
          
          {/* Row 2: Values */}
          <div className="grid grid-cols-3 bg-white min-h-[80px]">
            {/* Agent Status Value */}
            <div className="p-4 flex flex-col items-center justify-center gap-2 border-r border-slate-100">
              <Badge 
                variant={agentEnabled ? (dqnMode ? "default" : "default") : "outline"} 
                className={`px-4 py-1.5 text-[10px] font-bold tracking-wider transition-all duration-300 ${
                  !agentEnabled 
                    ? "text-slate-400 border-slate-200" 
                    : dqnMode 
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 border-indigo-600" 
                      : "bg-purple-100 text-purple-700 border-purple-200"
                }`}
              >
                {!agentEnabled ? 'MANUAL' : dqnMode ? 'DQN LEARNING' : 'AUTOMATIC'}
              </Badge>
            </div>
            
            {/* Traffic Dynamics Value */}
            <div className="p-4 flex flex-col items-center justify-center gap-1.5 border-r border-slate-100">
              <div className="flex flex-col gap-1 w-full">
                <div className="flex justify-between items-center px-2 py-0.5 bg-amber-50/50 rounded border border-amber-100/50">
                  <span className="text-[9px] font-bold text-amber-500 uppercase">Random</span>
                  <span className="text-xs font-bold text-amber-700">{(config.trafficRandomness * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between items-center px-2 py-0.5 bg-amber-50/50 rounded border border-amber-100/50">
                  <span className="text-[9px] font-bold text-amber-500 uppercase">Spawn</span>
                  <span className="text-xs font-bold text-amber-700">{config.spawnRate.toFixed(1)}/s</span>
                </div>
              </div>
            </div>
            
            {/* Sensor Uncertainty Value */}
            <div className="p-4 flex flex-col items-center justify-center gap-1.5">
              <div className="flex flex-col gap-1 w-full">
                <div className="flex justify-between items-center px-2 py-0.5 bg-blue-50/50 rounded border border-blue-100/50">
                  <span className="text-[9px] font-bold text-blue-400 uppercase">Queue</span>
                  <span className="text-xs font-bold text-blue-700">±{Math.round(noiseConfig.queueLengthNoise)}</span>
                </div>
                <div className="flex justify-between items-center px-2 py-0.5 bg-blue-50/50 rounded border border-blue-100/50">
                  <span className="text-[9px] font-bold text-blue-400 uppercase">Wait</span>
                  <span className="text-xs font-bold text-blue-700">{(noiseConfig.avgWaitingTimeNoise * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Extended Telemetry (Conditional) */}
        {agentEnabled && dqnMode && dqnMetrics && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="text-xs bg-indigo-50 p-3 rounded-xl border border-indigo-200 space-y-2 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-indigo-900 border-b border-indigo-100 pb-1 mb-1">
                <Cpu className="w-3.5 h-3.5" />
                DQN Learning Telemetry
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-indigo-700">
                <div className="flex justify-between border-b border-indigo-100/50 pb-0.5">
                  <span className="opacity-70">Epsilon (ε):</span>
                  <span className="font-mono font-bold">{dqnMetrics.epsilon.toFixed(3)}</span>
                </div>
                <div className="flex justify-between border-b border-indigo-100/50 pb-0.5">
                  <span className="opacity-70">Loss:</span>
                  <span className="font-mono font-bold">{dqnMetrics.loss.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">Training Steps:</span>
                  <span className="font-mono font-bold">{dqnMetrics.trainingSteps}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">Experience Count:</span>
                  <span className="font-mono font-bold">{dqnMetrics.experienceCount}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Traffic Pattern Display */}
        <TrafficPatternDisplay burstState={config.trafficBurstState} />

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
