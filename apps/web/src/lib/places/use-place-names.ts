"use client";

import { useEffect, useMemo, useState } from "react";

import { fetchPlaceDeduped } from "@/lib/places/place-client-cache";

/** Batch-resolve place display names for a list of place IDs (deduped). */
export function usePlaceNames(placeIds: string[]): Record<string, string | null> {
  const uniqueIds = useMemo(
    () => [...new Set(placeIds.filter((id) => id.length > 0))].sort(),
    [placeIds],
  );
  const [names, setNames] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (uniqueIds.length === 0) {
      return;
    }

    let cancelled = false;
    void Promise.all(
      uniqueIds.map(async (placeId) => {
        const place = await fetchPlaceDeduped(placeId);
        return [placeId, place?.name ?? null] as const;
      }),
    ).then((entries) => {
      if (!cancelled) {
        setNames(Object.fromEntries(entries));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [uniqueIds]);

  if (uniqueIds.length === 0) {
    return {};
  }

  return names;
}
