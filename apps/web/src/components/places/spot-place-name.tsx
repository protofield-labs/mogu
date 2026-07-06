"use client";

import { usePlace } from "@/lib/places/use-place";

type SpotPlaceNameProps = {
  placeId: string;
  fallback?: string;
  className?: string;
  /** When set, skips an internal Places fetch (use parent `usePlace` result). */
  placeName?: string | null;
  loading?: boolean;
};

export function SpotPlaceName({
  placeId,
  fallback = "スポット",
  className,
  placeName: externalPlaceName,
  loading: externalLoading,
}: SpotPlaceNameProps) {
  const internal = usePlace(placeId, externalPlaceName === undefined);
  const placeName =
    externalPlaceName !== undefined ? externalPlaceName : internal.placeName;
  const loading =
    externalLoading !== undefined ? externalLoading : internal.loading;

  if (loading && !placeName) {
    return <span className={className}>{fallback}</span>;
  }

  return <span className={className}>{placeName ?? fallback}</span>;
}
