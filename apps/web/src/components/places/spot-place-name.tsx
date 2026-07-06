"use client";

import { usePlace } from "@/lib/places/use-place";

type SpotPlaceNameProps = {
  placeId: string;
  fallback?: string;
  className?: string;
  loadingClassName?: string;
};

export function SpotPlaceName({
  placeId,
  fallback = "スポット",
  className,
  loadingClassName,
}: SpotPlaceNameProps) {
  const { placeName, loading } = usePlace(placeId);

  if (loading && !placeName) {
    return (
      <span className={loadingClassName ?? "text-muted-foreground"}>
        読み込み中…
      </span>
    );
  }

  return <span className={className}>{placeName ?? fallback}</span>;
}
