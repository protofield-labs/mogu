"use client";

import { SpotPlaceName } from "@/components/places/spot-place-name";
import { SpotThumbnail } from "@/components/places/spot-thumbnail";
import { formatRatingChip, formatSavedCountBadge } from "@/lib/home/feed-labels";
import { usePlace } from "@/lib/places/use-place";
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
        <SpotListRow
          key={spot.id}
          spot={spot}
          onSelect={onSelect}
          placeName={placeNames?.[spot.placeId]}
          distanceLabel={distanceLabels?.[spot.id]}
        />
      ))}
    </ul>
  );
}

function SpotListRow({
  spot,
  onSelect,
  placeName,
  distanceLabel,
}: {
  spot: Spot;
  onSelect: (spot: Spot) => void;
  placeName?: string | null;
  distanceLabel?: string;
}) {
  // Place photos fill empty spot.photoUrls (collection detail #254 / #191).
  const needsPlacePhoto = spot.photoUrls.length === 0;
  const { place, loading: placeLoading } = usePlace(
    spot.placeId,
    needsPlacePhoto,
  );

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(spot)}
        className="w-full rounded-2xl bg-mogu-surface-elevated p-4 text-left shadow-mogu-card transition-colors hover:bg-muted/30"
      >
        <div className="flex gap-3">
          <SpotThumbnail
            spot={spot}
            place={place}
            placeLoading={needsPlacePhoto && placeLoading}
            className="size-16 shrink-0 rounded-xl object-cover"
            placeholder="label"
            placeholderLabel="写真なし"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              <SpotPlaceName
                placeId={spot.placeId}
                fallback={spot.comment || "スポット"}
                placeName={placeName}
              />
            </p>
            {spot.comment ? (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {spot.comment}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-muted-foreground">
              {[formatRatingChip(spot.rating), formatSavedCountBadge(spot.savedCount)]
                .filter(Boolean)
                .join(" ・ ")}
              {distanceLabel ? ` ・ ${distanceLabel}` : ""}
            </p>
          </div>
        </div>
      </button>
    </li>
  );
}
