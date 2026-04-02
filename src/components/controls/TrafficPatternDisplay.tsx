/**
 * Traffic Pattern Display Component
 * 
 * Shows real-time traffic burst state:
 * - Current burst direction (if active)
 * - Burst intensity level
 * - Time remaining in current burst
 * - Individual direction intensities as a gauge
 */

import { TrafficBurstState, Direction } from '@/types/simulation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TrafficPatternDisplayProps {
  burstState?: TrafficBurstState;
}

const directionLabels: Record<Direction, string> = {
  north: 'North ↑',
  south: 'South ↓',
  east: 'East →',
  west: 'West ←',
};

const directionColors: Record<Direction, string> = {
  north: 'text-blue-600',
  south: 'text-blue-600',
  east: 'text-green-600',
  west: 'text-green-600',
};

function IntensityBar({
  direction,
  intensity,
}: {
  direction: Direction;
  intensity: number;
}) {
  // Scale intensity from 0-2 to 0-100 for visual representation
  const percent = (intensity / 2) * 100;
  // Color based on intensity: blue for low, yellow for medium, red for high
  let bgColor = 'bg-blue-200';
  if (intensity > 1.3) bgColor = 'bg-yellow-300';
  if (intensity > 1.6) bgColor = 'bg-orange-400';
  if (intensity > 1.8) bgColor = 'bg-red-500';

  return (
    <div className="flex items-center gap-3 mb-2">
      <div className={`w-12 text-xs font-semibold ${directionColors[direction]}`}>
        {directionLabels[direction]}
      </div>
      <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full ${bgColor} transition-all duration-200`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="w-8 text-right text-xs font-mono">
        {intensity.toFixed(2)}x
      </div>
    </div>
  );
}

export function TrafficPatternDisplay({ burstState }: TrafficPatternDisplayProps) {
  if (!burstState) {
    return null;
  }

  const hasBurst = burstState.activeBurstDirection !== null;
  const burstTimeSeconds = Math.ceil(burstState.timeRemainingInBurst / 1000);
  const nextBurstSeconds = Math.ceil(burstState.timeUntilNextBurst / 1000);

  return (
    <Card className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 border-slate-300">
      <div className="space-y-3">
        {/* Burst Status Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700">Traffic Pattern</h3>
          {hasBurst ? (
            <Badge variant="default" className="bg-red-600">
              Active Burst
            </Badge>
          ) : (
            <Badge variant="outline">Baseline Traffic</Badge>
          )}
        </div>

        {/* Current Burst Info */}
        {hasBurst && burstState.activeBurstDirection && (
          <div className="bg-white rounded p-2 border border-red-200">
            <div className="text-xs text-slate-600 mb-1">
              Surge Direction:
              <span className={`font-bold ml-1 ${directionColors[burstState.activeBurstDirection]}`}>
                {directionLabels[burstState.activeBurstDirection]}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">
                Intensity: <span className="font-mono font-bold">{burstState.burstIntensity.toFixed(2)}x</span>
              </span>
              <span className="text-slate-600">
                Time Remaining: <span className="font-mono font-bold">{burstTimeSeconds}s</span>
              </span>
            </div>
          </div>
        )}

        {/* Next Burst Timer */}
        {!hasBurst && nextBurstSeconds > 0 && (
          <div className="bg-white rounded p-2 border border-blue-200 text-xs text-slate-600">
            Next Burst in: <span className="font-mono font-bold">{nextBurstSeconds}s</span>
          </div>
        )}

        {/* Direction Intensity Gauges */}
        <div className="space-y-2 pt-2 border-t border-slate-200">
          <p className="text-xs font-semibold text-slate-600 uppercase">
            Direction Intensity
          </p>
          <div>
            <IntensityBar
              direction="north"
              intensity={burstState.directionIntensities.north}
            />
            <IntensityBar
              direction="south"
              intensity={burstState.directionIntensities.south}
            />
            <IntensityBar
              direction="east"
              intensity={burstState.directionIntensities.east}
            />
            <IntensityBar
              direction="west"
              intensity={burstState.directionIntensities.west}
            />
          </div>
        </div>

        {/* Info */}
        <p className="text-xs text-slate-500 pt-2 border-t border-slate-200">
          Traffic patterns change every 15-30s, with 20-40s intensity bursts on random directions.
        </p>
      </div>
    </Card>
  );
}
