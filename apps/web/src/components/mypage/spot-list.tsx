"use client";

import { SpotListRow } from "@/components/spots/spot-list-row";
import type { Spot } from "@/lib/spots/browser-api";

type SpotListProps = {
  spots: Spot[];
  onSelect: (spot: Spot) => void;
  placeNames?: Record<string, string | null>;
  distanceLabels?: Record<string, string>;
};

export function SpotList({
  spots,
  onSelect,
  placeNames,
  distanceLabels,
}: SpotListProps) {
  if (spots.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-3">
      {spots.map((spot) => (
        <li key={spot.id}>
          <SpotListRow
            spot={spot}
            onSelect={() => onSelect(spot)}
            placeName={placeNames?.[spot.placeId]}
            distanceLabel={distanceLabels?.[spot.id]}
          />
        </li>
      ))}
    </ul>
  );
}
