"use client";

import { AuthImage } from "@/components/mypage/auth-image";
import { SpotPlaceName } from "@/components/places/spot-place-name";
import { formatRatingChip, formatSavedCountBadge } from "@/lib/home/feed-labels";
import type { Spot } from "@/lib/spots/browser-api";

type SpotListProps = {
  spots: Spot[];
  onSelect: (spot: Spot) => void;
  placeNames?: Record<string, string | null>;
};

export function SpotList({ spots, onSelect, placeNames }: SpotListProps) {
  if (spots.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-3">
      {spots.map((spot) => (
        <li key={spot.id}>
          <button
            type="button"
            onClick={() => onSelect(spot)}
            className="w-full rounded-2xl border border-border bg-mogu-surface-elevated p-4 text-left transition-colors hover:bg-muted/30"
          >
            <div className="flex gap-3">
              {spot.photoUrls[0] ? (
                <AuthImage
                  objectUrl={spot.photoUrls[0]}
                  alt=""
                  className="size-16 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <div className="size-16 shrink-0 rounded-xl bg-muted" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  <SpotPlaceName
                    placeId={spot.placeId}
                    fallback={spot.comment || "スポット"}
                    placeName={placeNames?.[spot.placeId]}
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
                </p>
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
