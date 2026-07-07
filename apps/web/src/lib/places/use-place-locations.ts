"use client";

import { useEffect, useMemo, useState } from "react";

import { fetchPlaceLocations } from "@/lib/places/browser-api";
import type { PlaceLocationDTO } from "@/lib/places/types";

type UsePlaceLocationsResult = {
  locations: Record<string, PlaceLocationDTO>;
  loading: boolean;
  error: string | null;
};

/** Batch-resolve place coordinates for map pins (deduped). */
export function usePlaceLocations(
  placeIds: string[],
  enabled = true,
): UsePlaceLocationsResult {
  const uniqueIds = useMemo(
    () => [...new Set(placeIds.filter((id) => id.length > 0))].sort(),
    [placeIds],
  );
  const requestKey = uniqueIds.join("\0");
  const shouldFetch = enabled && uniqueIds.length > 0;
  const [locations, setLocations] = useState<Record<string, PlaceLocationDTO>>({});
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  // Error is keyed to the request it belongs to, so a new request (changed
  // placeIds) naturally re-enters the loading state instead of showing a
  // stale error from the previous fetch.
  const [errorState, setErrorState] = useState<{
    key: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!shouldFetch) {
      return;
    }

    let cancelled = false;

    void fetchPlaceLocations(requestKey.split("\0"))
      .then((places) => {
        if (cancelled) {
          return;
        }
        setLocations(Object.fromEntries(places.map((place) => [place.placeId, place])));
        setErrorState(null);
        setResolvedKey(requestKey);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        // Keep previously resolved coordinates so a transient refetch failure
        // does not blank out an already-working map.
        setErrorState({
          key: requestKey,
          message:
            err instanceof Error ? err.message : "位置情報を読み込めませんでした",
        });
        setResolvedKey(requestKey);
      });

    return () => {
      cancelled = true;
    };
  }, [shouldFetch, requestKey]);

  if (!shouldFetch) {
    return { locations: {}, loading: false, error: null };
  }

  const error = errorState?.key === requestKey ? errorState.message : null;

  return {
    locations,
    loading: resolvedKey !== requestKey && error === null,
    error,
  };
}
