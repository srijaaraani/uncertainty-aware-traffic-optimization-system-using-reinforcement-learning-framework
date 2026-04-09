/**
 * MetricsDisplay Component
 * 
 * Displays real-time traffic simulation metrics including:
 * - Queue length per lane
 * - Waiting time per lane
 * - Vehicle flow rate
 * - Average speed and delay
 * - Time since last signal change
 * 
 * Enhanced to show sensor uncertainty with:
 * - True environment values (black)
 * - Probability distribution representations
 * - Sampled observed values (dark red) - what the agent perceives
 */

import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SimulationMetrics, Direction, SimulationConfig, TrafficLightState } from '@/types/simulation';
import { calculateMetrics } from '@/utils/metricsCalculator';
import { Vehicle } from '@/types/simulation';
import { getEnvironmentState } from '@/utils/environmentState';
import { applyTrainingNoise, TrainingNoiseConfig } from '@/corelogic/probabilisticSensorModel';
import { BarChart3, Clock, TrendingUp, Gauge, Timer, Eye, Activity } from 'lucide-react';

interface MetricsDisplayProps {
  vehicles: Vehicle[];
  config: SimulationConfig;
  lastSignalChangeTime: number;
  isRunning: boolean;
  signalState: TrafficLightState;
  trainingNoiseConfig: TrainingNoiseConfig;
  trainingNoiseEnabled: boolean;
  agentEnabled?: boolean;
  hasSimulationBeenStarted: boolean;
  simulationSessionId: number;
  onNoisyObservationUpdate?: (observation: any) => void;
  virtualBaseState?: {
    ns: { queueLength: number, avgWaitingTime: number, flowRate: number },
    ew: { queueLength: number, avgWaitingTime: number, flowRate: number }
  };
}

/**
 * Formats a discrete distribution representation for queue length
 */
function formatDiscreteDistribution(trueValue: number, k: number): string {
  const v = Math.round(trueValue);
  const kInt = Math.max(0, Math.round(k));
  const min = Math.max(0, v - kInt);
  const max = v + kInt;
  
  if (kInt === 0) {
    return `{${v}}`;
  }
  
  // For small ranges, show all values
  if (max - min <= 6) {
    const values: number[] = [];
    for (let i = min; i <= max; i++) {
      values.push(i);
    }
    return `{${values.join(', ')}}`;
  }
  
  // For larger ranges, show range notation
  return `[${min} ... ${max}]`;
}

/**
 * Formats a continuous distribution representation
 */
function formatContinuousDistribution(trueValue: number, stdDevFraction: number): string {
  if (stdDevFraction <= 0 || trueValue <= 0) {
    return `${trueValue.toFixed(2)}`;
  }
  
  const stdDev = trueValue * stdDevFraction;
  const min = Math.max(0, trueValue - 2 * stdDev); // ±2σ for 95% confidence
  const max = trueValue + 2 * stdDev;
  
  return `~N(μ=${trueValue.toFixed(1)}, σ=${stdDev.toFixed(2)})`;
}

/**
 * Component to display a metric with three layers: Traffic (Base), True (Post-Env Noise), and Observed (Post-Obs Noise)
 */
function TripleLayerMetric({
  label,
  value,
  isDiscrete,
  k,
  stdDevFraction,
  unit,
  formatValue,
}: {
  label: string;
  value: LayeredMetric;
  isDiscrete: boolean;
  k?: number;
  stdDevFraction?: number;
  unit: string;
  formatValue: (val: number) => string;
}) {
  const distribution = isDiscrete
    ? formatDiscreteDistribution(value.true, k || 0)
    : formatContinuousDistribution(value.true, stdDevFraction || 0);

  const deltaEnv = value.true - value.base;
  const deltaObs = value.observed - value.true;

  return (
    <div className="space-y-2 py-2 border-b border-border/40 last:border-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-foreground/80 uppercase tracking-tight">{label}</span>
        <span className="text-[10px] text-muted-foreground italic">Dist: {distribution}</span>
      </div>

      <div className="grid grid-cols-1 gap-1.5 pl-1">
        {/* Layer 1: Traffic State (Base) */}
        <div className="flex items-center justify-between bg-blue-50/20 dark:bg-blue-900/5 p-1 rounded">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-blue-500/70" />
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Original Traffic State:</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-medium text-slate-700 dark:text-slate-300">
              {formatValue(value.base)}
            </span>
            <span className="text-[10px] text-slate-500 w-12">{unit}</span>
          </div>
        </div>

        {/* Layer 2: True State (Post-Env Noise) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-foreground">True Environment:</span>
            {Math.abs(deltaEnv) > 0.01 && (
              <span className={`text-[9px] font-bold px-1 rounded ${deltaEnv > 0 ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                Δ Env: {deltaEnv > 0 ? '+' : ''}{isDiscrete ? Math.round(deltaEnv) : deltaEnv.toFixed(1)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold text-foreground">
              {formatValue(value.true)}
            </span>
            <span className="text-[10px] text-muted-foreground w-12">{unit}</span>
          </div>
        </div>

        {/* Layer 3: Observed State (Post-Obs Noise) */}
        <div className="flex items-center justify-between bg-red-50/30 dark:bg-red-950/10 p-1 rounded">
          <div className="flex items-center gap-1.5">
            <Eye className="w-3 h-3 text-red-500" />
            <span className="text-[11px] font-bold text-red-700 dark:text-red-400">Observed State:</span>
            {Math.abs(deltaObs) > 0.01 && (
              <span className={`text-[9px] font-bold px-1 rounded ${deltaObs > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                Δ Obs: {deltaObs > 0 ? '+' : ''}{isDiscrete ? Math.round(deltaObs) : deltaObs.toFixed(1)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-black text-red-800 dark:text-red-300">
              {formatValue(value.observed)}
            </span>
            <span className="text-[10px] text-red-600/70 w-12">{unit}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MetricsDisplay({
  vehicles,
  config,
  lastSignalChangeTime,
  isRunning,
  signalState,
  trainingNoiseConfig,
  trainingNoiseEnabled,
  agentEnabled,
  hasSimulationBeenStarted,
  simulationSessionId,
  onNoisyObservationUpdate,
  virtualBaseState,
}: MetricsDisplayProps) {
  const [metrics, setMetrics] = useState<SimulationMetrics | null>(null);
  const [trueState, setTrueState] = useState<ReturnType<typeof getEnvironmentState> | null>(null);
  const [noisyState, setNoisyState] = useState<ReturnType<typeof applyTrainingNoise> | null>(null);
  const [samplingKey, setSamplingKey] = useState(0);

  // Use a ref to store latest props for the interval to prevent constant resets
  const latestPropsRef = useRef({
    vehicles,
    config,
    signalState,
    lastSignalChangeTime,
    virtualBaseState,
    trainingNoiseConfig,
    agentEnabled,
    onNoisyObservationUpdate
  });

  useEffect(() => {
    latestPropsRef.current = {
      vehicles,
      config,
      signalState,
      lastSignalChangeTime,
      virtualBaseState,
      trainingNoiseConfig,
      agentEnabled,
      onNoisyObservationUpdate
    };
  }, [vehicles, config, signalState, lastSignalChangeTime, virtualBaseState, trainingNoiseConfig, agentEnabled, onNoisyObservationUpdate]);

  // Reset metrics when a new simulation session starts (after reset)
  useEffect(() => {
    setMetrics(null);
    setTrueState(null);
    setNoisyState(null);
  }, [simulationSessionId]);

  // Update metrics periodically
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      const { 
        vehicles: currentVehicles, 
        config: currentConfig, 
        signalState: currentSignalState, 
        lastSignalChangeTime: currentLastSignalChangeTime,
        virtualBaseState: currentVirtualBaseState,
        trainingNoiseConfig: currentTrainingNoiseConfig,
        agentEnabled: currentAgentEnabled,
        onNoisyObservationUpdate: currentOnNoisyObservationUpdate
      } = latestPropsRef.current;

      const calculatedMetrics = calculateMetrics(
        currentVehicles,
        currentConfig,
        currentLastSignalChangeTime
      );
      setMetrics(calculatedMetrics);
      
      // Calculate true environment state (including base and physical noise)
      const envState = getEnvironmentState(
        currentVehicles, 
        currentConfig, 
        currentSignalState, 
        currentLastSignalChangeTime
      );
      
      // Update local state for rendering
      setTrueState(envState);
      
      // Apply observation noise to get Observed State
      const noisy = applyTrainingNoise(envState, currentTrainingNoiseConfig);
      setNoisyState(noisy);
      
      // Increment sampling key to force re-render
      setSamplingKey(prev => prev + 1);
      
      // If agent is enabled, provide noisy observation to agent
      if (currentAgentEnabled && currentOnNoisyObservationUpdate) {
        const agentObservation = {
          signalPhase: noisy.signalPhase,
          ns: {
            queueLength: noisy.ns.queueLength.observed,
            avgWaitingTime: noisy.ns.avgWaitingTime.observed,
          },
          ew: {
            queueLength: noisy.ew.queueLength.observed,
            avgWaitingTime: noisy.ew.avgWaitingTime.observed,
          },
        };
        currentOnNoisyObservationUpdate(agentObservation);
      }
    }, 500); // Update every 500ms

    return () => clearInterval(interval);
  }, [isRunning]); // Only depends on running state

  // Note: The interval-based effect above (running every 500ms via latestPropsRef)
  // handles all metric updates. No second effect needed.

  // When paused, keep displaying the last frozen metrics (do not resample)
  // This ensures all traffic metrics remain static when simulation is paused
  useEffect(() => {
    if (isRunning || !trueState) return;
    
    // Simulation is paused - do nothing, keep showing frozen metrics
    // This prevents any changes to the displayed metrics while paused
  }, [isRunning, trueState]);

  if (!hasSimulationBeenStarted) {
    // Don't render metrics before the first run starts
    return null;
  }

  if (!metrics || !trueState || !noisyState) {
    // During first seconds of run this might still be loading; avoid empty placeholder.
    return null;
  }

  const directions: Direction[] = ['north', 'south', 'east', 'west'];
  const directionLabels: Record<Direction, string> = {
    north: 'North',
    south: 'South',
    east: 'East',
    west: 'West',
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(0);
    return `${mins}m ${secs}s`;
  };

  return (
    <Card className="w-full shadow-lg max-h-[600px] flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="w-5 h-5" />
          Traffic Metrics
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6 overflow-y-auto flex-1">
        {/* Time since last signal change */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              Time Since Last Signal Change
            </span>
          </div>
          <span className="font-mono font-semibold text-foreground">
            {formatTime(metrics.timeSinceLastSignalChange)}
          </span>
        </div>

        {/* Total Flow Rate */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              Total Flow Rate
            </span>
          </div>
          <span className="font-mono font-semibold text-foreground">
            {metrics.totalFlowRate.toFixed(1)} veh/min
          </span>
        </div>

        {/* --- ENVIRONMENT DYNAMICS DEBUGGER --- */}
        <div className="p-4 bg-orange-50/20 dark:bg-orange-950/10 rounded-lg border border-orange-200/50 dark:border-orange-800/30 space-y-3">
          <h3 className="text-xs font-bold text-orange-800 dark:text-orange-400 uppercase flex items-center gap-2">
            <Gauge className="w-3.5 h-3.5" />
            Environment Dynamics Debugger
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground block">Spawn Intensity</span>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${config.environmentNoise.spawnJitter > 0.5 ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`} />
                <span className="text-xs font-mono font-bold">
                  {(1 + (config.environmentNoise.spawnJitter * 0.5)).toFixed(2)}x
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground block">Speed Variance</span>
              <span className="text-xs font-mono font-bold">
                ±{(config.environmentNoise.speedVariance * 100).toFixed(0)}%
              </span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground block">Directional Bias</span>
              <span className="text-xs font-mono font-bold">
                {config.environmentNoise.directionalBias === 0 ? 'Balanced' : 
                 config.environmentNoise.directionalBias > 0 ? `NS Heavy (${(config.environmentNoise.directionalBias * 100).toFixed(0)}%)` : 
                 `EW Heavy (${(Math.abs(config.environmentNoise.directionalBias) * 100).toFixed(0)}%)`}
              </span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground block">Burst Intensity</span>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded ${config.trafficBurstState?.activeBurstDirection ? 'bg-red-500 animate-bounce' : 'bg-gray-300'}`} />
                <span className="text-xs font-mono font-bold">
                  {(config.environmentNoise.burstIntensity).toFixed(1)}x
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Aggregated Metrics with 3-Layer Flow */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">
            Aggregated Metrics (with Training Noise)
          </h3>
          
          {/* Helper: merge base/true from trueState with observed from noisyState */}
          {(() => {
            const m = (trueMetric: typeof trueState.ns.queueLength, noisyMetric: typeof noisyState.ns.queueLength) => ({
              base: trueMetric.base,
              true: trueMetric.true,
              observed: noisyMetric.observed,
            });

          return (
            <>
          {/* North-South Direction */}
          <div className="p-4 bg-muted/50 rounded-lg border border-border space-y-1">
            <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">
              North-South (NS)
            </h4>
            
            <TripleLayerMetric
              label="Queue Length"
              value={m(trueState.ns.queueLength, noisyState.ns.queueLength)}
              isDiscrete={true}
              k={trainingNoiseConfig.queueLengthNoise}
              unit="vehicles"
              formatValue={(v) => {
                const rounded = Math.round(v);
                const raw = v.toFixed(2);
                return rounded === 0 && v > 0 ? `${raw}` : `${rounded}`;
              }}
            />
            
            <TripleLayerMetric
              label="Avg Waiting Time"
              value={m(trueState.ns.avgWaitingTime, noisyState.ns.avgWaitingTime)}
              isDiscrete={false}
              stdDevFraction={trainingNoiseConfig.avgWaitingTimeNoise}
              unit="s"
              formatValue={(v) => v.toFixed(1)}
            />
            
            <TripleLayerMetric
              label="Max Waiting Time"
              value={m(trueState.ns.maxWaitingTime, noisyState.ns.maxWaitingTime)}
              isDiscrete={false}
              stdDevFraction={trainingNoiseConfig.avgWaitingTimeNoise}
              unit="s"
              formatValue={(v) => v.toFixed(1)}
            />
            
            <TripleLayerMetric
              label="Flow Rate"
              value={m(trueState.ns.flowRate, noisyState.ns.flowRate)}
              isDiscrete={false}
              stdDevFraction={0}
              unit="veh/min"
              formatValue={(v) => v.toFixed(1)}
            />
            
            <TripleLayerMetric
              label="Average Speed"
              value={m(trueState.ns.avgSpeed, noisyState.ns.avgSpeed)}
              isDiscrete={false}
              stdDevFraction={trainingNoiseConfig.avgSpeedNoise}
              unit="px/frame"
              formatValue={(v) => v.toFixed(2)}
            />
          </div>

          {/* East-West Direction */}
          <div className="p-4 bg-muted/50 rounded-lg border border-border space-y-1">
            <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">
              East-West (EW)
            </h4>
            
            <TripleLayerMetric
              label="Queue Length"
              value={m(trueState.ew.queueLength, noisyState.ew.queueLength)}
              isDiscrete={true}
              k={trainingNoiseConfig.queueLengthNoise}
              unit="vehicles"
              formatValue={(v) => {
                const rounded = Math.round(v);
                const raw = v.toFixed(2);
                return rounded === 0 && v > 0 ? `${raw}` : `${rounded}`;
              }}
            />
            
            <TripleLayerMetric
              label="Avg Waiting Time"
              value={m(trueState.ew.avgWaitingTime, noisyState.ew.avgWaitingTime)}
              isDiscrete={false}
              stdDevFraction={trainingNoiseConfig.avgWaitingTimeNoise}
              unit="s"
              formatValue={(v) => v.toFixed(1)}
            />
            
            <TripleLayerMetric
              label="Max Waiting Time"
              value={m(trueState.ew.maxWaitingTime, noisyState.ew.maxWaitingTime)}
              isDiscrete={false}
              stdDevFraction={trainingNoiseConfig.avgWaitingTimeNoise}
              unit="s"
              formatValue={(v) => v.toFixed(1)}
            />
            
            <TripleLayerMetric
              label="Flow Rate"
              value={m(trueState.ew.flowRate, noisyState.ew.flowRate)}
              isDiscrete={false}
              stdDevFraction={0}
              unit="veh/min"
              formatValue={(v) => v.toFixed(1)}
            />
            
            <TripleLayerMetric
              label="Average Speed"
              value={m(trueState.ew.avgSpeed, noisyState.ew.avgSpeed)}
              isDiscrete={false}
              stdDevFraction={trainingNoiseConfig.avgSpeedNoise}
              unit="px/frame"
              formatValue={(v) => v.toFixed(2)}
            />
          </div>
          </>
          );
          })()}
        </div>

        {/* Per-direction metrics (original per-lane view) */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Per-Lane Metrics</h3>
          
          {directions.map((direction) => {
            const numLanes = config.laneConfig[direction];
            return (
              <div key={direction} className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase">
                  {directionLabels[direction]}
                </h4>
                
                {Array.from({ length: numLanes }, (_, laneIndex) => {
                  const key = `${direction}-${laneIndex}`;
                  const laneMetric = metrics.laneMetrics[key];
                  
                  if (!laneMetric) {
                    return null;
                  }

                  return (
                    <div
                      key={key}
                      className="p-3 bg-muted/50 rounded-lg border border-border space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Lane {laneIndex + 1}</span>
                      </div>

                      {/* Queue Length */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-orange-500" />
                          <span className="text-xs text-muted-foreground">Queue Length</span>
                        </div>
                        <span className="font-mono text-sm font-semibold text-foreground">
                          {laneMetric.queueLength}
                        </span>
                      </div>

                      {/* Waiting Time */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Avg Wait</span>
                        </div>
                        <span className="font-mono text-xs text-foreground">
                          {laneMetric.avgWaitingTime.toFixed(1)}s
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Max Wait</span>
                        </div>
                        <span className="font-mono text-xs text-foreground">
                          {laneMetric.maxWaitingTime.toFixed(1)}s
                        </span>
                      </div>

                      {/* Flow Rate */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Flow Rate</span>
                        </div>
                        <span className="font-mono text-xs text-foreground">
                          {laneMetric.flowRate.toFixed(1)} veh/min
                        </span>
                      </div>

                      {/* Speed & Delay */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Gauge className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Avg Speed</span>
                        </div>
                        <span className="font-mono text-xs text-foreground">
                          {laneMetric.avgSpeed.toFixed(2)} px/frame
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Gauge className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Avg Delay</span>
                        </div>
                        <span className="font-mono text-xs text-foreground">
                          {laneMetric.avgDelay.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
