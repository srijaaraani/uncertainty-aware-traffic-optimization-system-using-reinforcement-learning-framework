/**
 * VehicleCounters Component
 * 
 * Displays the count of vehicles that have passed through
 * from each direction.
 */

import React from 'react';
import { VehicleCounts } from '@/types/simulation';
import { ArrowDown, ArrowUp, ArrowLeft, ArrowRight } from 'lucide-react';

interface VehicleCountersProps {
  counts: VehicleCounts;
}

export function VehicleCounters({ counts }: VehicleCountersProps) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">
        Vehicle Counts
      </label>
      
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 bg-muted rounded-lg p-2">
          <ArrowDown className="w-4 h-4 text-blue-600" />
          <span className="text-xs text-muted-foreground">North</span>
          <span className="ml-auto font-mono font-semibold text-foreground">
            {counts.north}
          </span>
        </div>
        
        <div className="flex items-center gap-2 bg-muted rounded-lg p-2">
          <ArrowUp className="w-4 h-4 text-blue-600" />
          <span className="text-xs text-muted-foreground">South</span>
          <span className="ml-auto font-mono font-semibold text-foreground">
            {counts.south}
          </span>
        </div>
        
        <div className="flex items-center gap-2 bg-muted rounded-lg p-2">
          <ArrowRight className="w-4 h-4 text-blue-600" />
          <span className="text-xs text-muted-foreground">West</span>
          <span className="ml-auto font-mono font-semibold text-foreground">
            {counts.west}
          </span>
        </div>
        
        <div className="flex items-center gap-2 bg-muted rounded-lg p-2">
          <ArrowLeft className="w-4 h-4 text-blue-600" />
          <span className="text-xs text-muted-foreground">East</span>
          <span className="ml-auto font-mono font-semibold text-foreground">
            {counts.east}
          </span>
        </div>
      </div>
      
      <div className="flex items-center justify-between bg-muted rounded-lg p-2">
        <span className="text-xs font-medium text-muted-foreground">Total</span>
        <span className="font-mono font-bold text-foreground">
          {counts.north + counts.south + counts.east + counts.west}
        </span>
      </div>
    </div>
  );
}
