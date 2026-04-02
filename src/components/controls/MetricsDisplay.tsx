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

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SimulationMetrics, Direction, SimulationConfig, TrafficLightState } from '@/types/simulation';
import { calculateMetrics } from '@/utils/metricsCalculator';
import { Vehicle } from '@/types/simulation';
import { getEnvironmentState } from '@/utils/environmentState';
import { applySensorNoise, SensorNoiseConfig } from '@/corelogic/probabilisticSensorModel';
import { BarChart3, Clock, TrendingUp, Gauge, Timer, Eye } from 'lucide-react';

interface MetricsDisplayProps {
  vehicles: Vehicle[];
  config: SimulationConfig;
  lastSignalChangeTime: number;
  isRunning: boolean;
  signalState: TrafficLightState;
  noiseConfig: SensorNoiseConfig;
  agentEnabled?: boolean;
  onNoisyObservationUpdate?: (observation: any) => void;
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
 * Component to display a metric with true value, distribution, and observed value
 */
function MetricWithUncertainty({
  label,
  trueValue,
  observedValue,
  isDiscrete,
  k,
  stdDevFraction,
  unit,
  formatValue,
}: {
  label: string;
  trueValue: number;
  observedValue: number;
  isDiscrete: boolean;
  k?: number;
  stdDevFraction?: number;
  unit: string;
  formatValue: (val: number) => string;
}) {
  const distribution = isDiscrete
    ? formatDiscreteDistribution(trueValue, k || 0)
    : formatContinuousDistribution(trueValue, stdDevFraction || 0);

  // Determine if there's a meaningful difference
  const isDifferent = Math.abs(trueValue - observedValue) > 0.01 || 
    (isDiscrete && Math.round(trueValue) !== Math.round(observedValue));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          {/* True value in black */}
          <span className="font-mono text-xs font-semibold text-foreground">
            {formatValue(trueValue)}
          </span>
          <span className="text-xs text-muted-foreground">{unit}</span>
        </div>
      </div>
      
      {/* Distribution representation */}
      <div className="text-xs text-muted-foreground/70 italic pl-2 border-l-2 border-muted">
        Dist: {distribution}
      </div>
      
      {/* Observed value in dark red */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Eye className={`w-3 h-3 ${isDifferent ? 'text-red-600 dark:text-red-500' : 'text-gray-400'}`} />
          <span className="text-xs text-muted-foreground">Observed:</span>
        </div>
        <span className={`font-mono text-xs font-bold ${
          isDifferent 
            ? 'text-red-800 dark:text-red-600' 
            : 'text-gray-600 dark:text-gray-400'
        }`}>
          {formatValue(observedValue)}
        </span>
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
  noiseConfig,
  agentEnabled,
  onNoisyObservationUpdate,
}: MetricsDisplayProps) {
  const [metrics, setMetrics] = useState<SimulationMetrics | null>(null);
  const [trueState, setTrueState] = useState<ReturnType<typeof getEnvironmentState> | null>(null);
  const [noisyState, setNoisyState] = useState<ReturnType<typeof applySensorNoise> | null>(null);
  const [samplingKey, setSamplingKey] = useState(0);

  // Update metrics periodically
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      const calculatedMetrics = calculateMetrics(
        vehicles,
        config,
        lastSignalChangeTime
      );
      setMetrics(calculatedMetrics);
      
      // Calculate true environment state
      const envState = getEnvironmentState(vehicles, config, signalState, lastSignalChangeTime);
      setTrueState(envState);
      
      // Apply sensor noise to get noisy observations
      // Note: Each call to applySensorNoise samples new values from distributions
      const noisy = applySensorNoise(envState, noiseConfig);
      setNoisyState(noisy);
      
      // Increment sampling key to force re-render of sampled observations
      setSamplingKey(prev => prev + 1);
      
      // If agent is enabled, provide noisy observation to agent
      if (agentEnabled && onNoisyObservationUpdate) {
        const agentObservation = {
          signalPhase: noisy.signalPhase,
          ns: {
            queueLength: noisy.ns.queueLength,
            avgWaitingTime: noisy.ns.avgWaitingTime,
          },
          ew: {
            queueLength: noisy.ew.queueLength,
            avgWaitingTime: noisy.ew.avgWaitingTime,
          },
        };
        onNoisyObservationUpdate(agentObservation);
      }
      
      // Debug logging
      console.log('DEBUG UPDATE - True State (NS):', {
        queueLength: envState.ns.queueLength,
        avgWaitingTime: envState.ns.avgWaitingTime.toFixed(2),
        avgSpeed: envState.ns.avgSpeed.toFixed(2),
      });
      console.log('DEBUG UPDATE - Noisy State (NS):', {
        queueLength: noisy.ns.queueLength,
        avgWaitingTime: noisy.ns.avgWaitingTime.toFixed(2),
        avgSpeed: noisy.ns.avgSpeed.toFixed(2),
      });
    }, 500); // Update every 500ms

    return () => clearInterval(interval);
  }, [vehicles, config, lastSignalChangeTime, isRunning, signalState, noiseConfig, agentEnabled, onNoisyObservationUpdate]);

  // Calculate metrics once on mount or when simulation state changes
  // IMPORTANT: When paused (!isRunning), do NOT recalculate metrics on dependency changes
  // This ensures metrics freeze when simulation is paused
  useEffect(() => {
    // Only calculate on mount/changes if simulation is running
    // When paused, we keep the last metrics and use the resample effect below
    if (!isRunning) return;
    
    const calculatedMetrics = calculateMetrics(
      vehicles,
      config,
      lastSignalChangeTime
    );
    setMetrics(calculatedMetrics);
    
    // Calculate true environment state
    const envState = getEnvironmentState(vehicles, config, signalState, lastSignalChangeTime);
    setTrueState(envState);
    
    // Apply sensor noise to get noisy observations
    const noisy = applySensorNoise(envState, noiseConfig);
    setNoisyState(noisy);
    
    // If agent is enabled, provide noisy observation to agent
    if (agentEnabled && onNoisyObservationUpdate) {
      const agentObservation = {
        signalPhase: noisy.signalPhase,
        ns: {
          queueLength: noisy.ns.queueLength,
          avgWaitingTime: noisy.ns.avgWaitingTime,
        },
        ew: {
          queueLength: noisy.ew.queueLength,
          avgWaitingTime: noisy.ew.avgWaitingTime,
        },
      };
      onNoisyObservationUpdate(agentObservation);
    }
    
    // Debug logging
    console.log('DEBUG UPDATE - True State (NS):', {
      queueLength: envState.ns.queueLength,
      avgWaitingTime: envState.ns.avgWaitingTime.toFixed(2),
      avgSpeed: envState.ns.avgSpeed.toFixed(2),
    });
    console.log('DEBUG UPDATE - Noisy State (NS):', {
      queueLength: noisy.ns.queueLength,
      avgWaitingTime: noisy.ns.avgWaitingTime.toFixed(2),
      avgSpeed: noisy.ns.avgSpeed.toFixed(2),
    });
  }, [vehicles, config, lastSignalChangeTime, signalState, noiseConfig, agentEnabled, onNoisyObservationUpdate, isRunning]);

  // When paused, keep displaying the last frozen metrics (do not resample)
  // This ensures all traffic metrics remain static when simulation is paused
  useEffect(() => {
    if (isRunning || !trueState) return;
    
    // Simulation is paused - do nothing, keep showing frozen metrics
    // This prevents any changes to the displayed metrics while paused
  }, [isRunning, trueState]);

  if (!metrics || !trueState || !noisyState) {
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

        {/* Aggregated Metrics with Sensor Uncertainty (NS/EW) */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">
            Aggregated Metrics (with Sensor Uncertainty)
          </h3>
          
          {/* North-South Direction */}
          <div className="p-4 bg-muted/50 rounded-lg border border-border space-y-3">
            <h4 className="text-xs font-medium text-muted-foreground uppercase">
              North-South (NS)
            </h4>
            
            <MetricWithUncertainty
              label="Queue Length"
              trueValue={trueState.ns.queueLength}
              observedValue={noisyState.ns.queueLength}
              isDiscrete={true}
              k={noiseConfig.queueLengthNoise}
              unit="vehicles"
              formatValue={(v) => {
                const rounded = Math.round(v);
                const raw = v.toFixed(2);
                return rounded === 0 && v > 0 ? `${raw}` : `${rounded}`;
              }}
            />
            
            <MetricWithUncertainty
              label="Average Waiting Time"
              trueValue={trueState.ns.avgWaitingTime}
              observedValue={noisyState.ns.avgWaitingTime}
              isDiscrete={false}
              stdDevFraction={noiseConfig.avgWaitingTimeNoise}
              unit="s"
              formatValue={(v) => v.toFixed(1)}
            />
            
            <MetricWithUncertainty
              label="Maximum Waiting Time"
              trueValue={trueState.ns.maxWaitingTime}
              observedValue={noisyState.ns.maxWaitingTime}
              isDiscrete={false}
              stdDevFraction={noiseConfig.avgWaitingTimeNoise}
              unit="s"
              formatValue={(v) => v.toFixed(1)}
            />
            
            <MetricWithUncertainty
              label="Flow Rate"
              trueValue={trueState.ns.flowRate}
              observedValue={noisyState.ns.flowRate}
              isDiscrete={false}
              stdDevFraction={0}
              unit="veh/min"
              formatValue={(v) => v.toFixed(1)}
            />
            
            <MetricWithUncertainty
              label="Average Speed"
              trueValue={trueState.ns.avgSpeed}
              observedValue={noisyState.ns.avgSpeed}
              isDiscrete={false}
              stdDevFraction={noiseConfig.avgSpeedNoise}
              unit="px/frame"
              formatValue={(v) => v.toFixed(2)}
            />
          </div>

          {/* East-West Direction */}
          <div className="p-4 bg-muted/50 rounded-lg border border-border space-y-3">
            <h4 className="text-xs font-medium text-muted-foreground uppercase">
              East-West (EW)
            </h4>
            
            <MetricWithUncertainty
              label="Queue Length"
              trueValue={trueState.ew.queueLength}
              observedValue={noisyState.ew.queueLength}
              isDiscrete={true}
              k={noiseConfig.queueLengthNoise}
              unit="vehicles"
              formatValue={(v) => {
                const rounded = Math.round(v);
                const raw = v.toFixed(2);
                return rounded === 0 && v > 0 ? `${raw}` : `${rounded}`;
              }}
            />
            
            <MetricWithUncertainty
              label="Average Waiting Time"
              trueValue={trueState.ew.avgWaitingTime}
              observedValue={noisyState.ew.avgWaitingTime}
              isDiscrete={false}
              stdDevFraction={noiseConfig.avgWaitingTimeNoise}
              unit="s"
              formatValue={(v) => v.toFixed(1)}
            />
            
            <MetricWithUncertainty
              label="Maximum Waiting Time"
              trueValue={trueState.ew.maxWaitingTime}
              observedValue={noisyState.ew.maxWaitingTime}
              isDiscrete={false}
              stdDevFraction={noiseConfig.avgWaitingTimeNoise}
              unit="s"
              formatValue={(v) => v.toFixed(1)}
            />
            
            <MetricWithUncertainty
              label="Flow Rate"
              trueValue={trueState.ew.flowRate}
              observedValue={noisyState.ew.flowRate}
              isDiscrete={false}
              stdDevFraction={0}
              unit="veh/min"
              formatValue={(v) => v.toFixed(1)}
            />
            
            <MetricWithUncertainty
              label="Average Speed"
              trueValue={trueState.ew.avgSpeed}
              observedValue={noisyState.ew.avgSpeed}
              isDiscrete={false}
              stdDevFraction={noiseConfig.avgSpeedNoise}
              unit="px/frame"
              formatValue={(v) => v.toFixed(2)}
            />
          </div>
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
