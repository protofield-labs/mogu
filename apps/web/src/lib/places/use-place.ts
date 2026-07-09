"use client";

import { useEffect, useState } from "react";

import { fetchPlaceDeduped } from "@/lib/places/place-client-cache";
import type { PlaceDTO } from "@/lib/agent/types";

type UsePlaceResult = {
  place: PlaceDTO | null;
  placeName: string | null;
  loading: boolean;
};

type PlaceState = {
  placeId: string;
  place: PlaceDTO | null;
};

/** Resolve place display fields at render time (guardrail 7). */
export function usePlace(placeId: string, enabled = true): UsePlaceResult {
  const active = enabled && placeId.length > 0;
  const [state, setState] = useState<PlaceState>({ placeId: "", place: null });

  useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;
    void fetchPlaceDeduped(placeId).then((result) => {
      if (!cancelled) {
        setState({ placeId, place: result });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [active, placeId]);

  const isCurrent = active && state.placeId === placeId;

  return {
    place: isCurrent ? state.place : null,
    placeName: isCurrent ? (state.place?.name ?? null) : null,
    loading: active && !isCurrent,
  };
}
