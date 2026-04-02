/**
 * LaneConfigToggle Component
 *
 * Toggle to switch between 1 and 2 lanes per direction.
 *
 * IMPORTANT:
 * - This only affects visual display
 * - No traffic logic is affected
 */

import { Button, type ButtonProps } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LaneConfig } from "@/types/simulation";

interface LaneConfigToggleProps {
  config: LaneConfig;
  onChange: (config: LaneConfig) => void;
}

export function LaneConfigToggle({
  config,
  onChange,
}: LaneConfigToggleProps) {
  const currentLanes = config.north;

  const setAllLanes = (lanes: 1 | 2) => {
    onChange({
      north: lanes,
      south: lanes,
      east: lanes,
      west: lanes,
    });
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium text-foreground">
        Lane Configuration
      </Label>

      <div className="flex gap-2">
        <Button
          onClick={() => setAllLanes(1)}
          variant={
            currentLanes === 1
              ? ("default" as ButtonProps["variant"])
              : ("outline" as ButtonProps["variant"])
          }
          size="sm"
          className="flex-1"
        >
          1 Lane
        </Button>

        <Button
          onClick={() => setAllLanes(2)}
          variant={
            currentLanes === 2
              ? ("default" as ButtonProps["variant"])
              : ("outline" as ButtonProps["variant"])
          }
          size="sm"
          className="flex-1"
        >
          2 Lanes
        </Button>
      </div>
    </div>
  );
}
