"use client";

import { SpotPlaceName } from "@/components/places/spot-place-name";
import { formatRatingChip } from "@/lib/home/feed-labels";
import { touchRowClass } from "@/lib/ui/touch-feedback";
import type { Spot } from "@/lib/spots/browser-api";
import { cn } from "@/lib/utils";

type MapNearbySpotListProps = {
  spots: Spot[];
  placeNames?: Record<string, string | null>;
  spotLabels?: Record<string, string>;
  distanceLabels: Record<string, string>;
  selectedSpotId: string | null;
  onSelectSpot: (spot: Spot) => void;
  /** Defaults to 「現在地から近い順」. */
  heading?: string;
  /** Defaults to 「現在地から近いスポット」. */
  ariaLabel?: string;
};

export function MapNearbySpotList({
  spots,
  placeNames,
  spotLabels,
  distanceLabels,
  selectedSpotId,
  onSelectSpot,
  heading = "現在地から近い順",
  ariaLabel = "現在地から近いスポット",
}: MapNearbySpotListProps) {
  if (spots.length === 0) {
    return null;
  }

  return (
    <section aria-label={ariaLabel} className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{heading}</h3>
      <ul className="max-h-56 space-y-2 overflow-y-auto">
        {spots.map((spot) => {
          const selected = selectedSpotId === spot.id;
          return (
            <li key={spot.id}>
              <button
                type="button"
                onClick={() => onSelectSpot(spot)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl bg-mogu-surface-elevated px-3 py-2.5 text-left shadow-mogu-card",
                  touchRowClass,
                  selected && "ring-2 ring-primary/30",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    <SpotPlaceName
                      placeId={spot.placeId}
                      fallback={spot.comment || "スポット"}
                      placeName={placeNames?.[spot.placeId]}
                    />
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {formatRatingChip(spot.rating)}
                    {spotLabels?.[spot.id] ? ` · ${spotLabels[spot.id]}` : ""}
                  </span>
                </span>
                {distanceLabels[spot.id] ? (
                  <span className="shrink-0 text-xs font-medium text-primary">
                    {distanceLabels[spot.id]}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
