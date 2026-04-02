/**
 * SignalOverride Component
 * 
 * Manual toggle to switch traffic signal between NS and EW green.
 * 
 * IMPORTANT: This is a manual override only.
 * No automated signal switching logic is implemented here.
 * 
 * CORE LOGIC WILL BE CONNECTED HERE LATER
 * External agents/algorithms can control signals via callbacks.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { TrafficLightState, SignalDirection } from '@/types/simulation';
import { cn } from '@/lib/utils';

interface SignalOverrideProps {
  signalState: TrafficLightState;
  onSignalChange: (direction: SignalDirection) => void;
  disabled?: boolean;
}

export function SignalOverride({
  signalState,
  onSignalChange,
  disabled,
}: SignalOverrideProps) {
  const isNSGreen = signalState.NS === 'green';

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">
        Signal Override (Manual)
      </label>
      
      <div className="flex gap-2">
        <Button
          onClick={() => onSignalChange('NS')}
          disabled={disabled}
          variant={isNSGreen ? 'default' : 'outline'}
          className={cn(
            "flex-1 transition-all",
            isNSGreen && "bg-green-600 hover:bg-green-700",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-3 h-3 rounded-full",
              isNSGreen ? "bg-green-300" : "bg-red-500"
            )} />
            N-S
          </div>
        </Button>
        
        <Button
          onClick={() => onSignalChange('EW')}
          disabled={disabled}
          variant={!isNSGreen ? 'default' : 'outline'}
          className={cn(
            "flex-1 transition-all",
            !isNSGreen && "bg-green-600 hover:bg-green-700",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-3 h-3 rounded-full",
              !isNSGreen ? "bg-green-300" : "bg-red-500"
            )} />
            E-W
          </div>
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {disabled ? (
          <>
            <strong>Agent is active</strong> — automatic control is enabled
          </>
        ) : (
          <>
            Click to manually switch signal state
          </>
        )}
      </p>
    </div>
  );
}
