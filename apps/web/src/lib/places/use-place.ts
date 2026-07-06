"use client";

import { useEffect, useState } from "react";

import { fetchPlace } from "@/lib/agent/browser-api";
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
export function usePlace(placeId: string): UsePlaceResult {
  const enabled = placeId.length > 0;
  const [state, setState] = useState<PlaceState>({ placeId: "", place: null });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    void fetchPlace(placeId).then((result) => {
      if (!cancelled) {
        setState({ placeId, place: result });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, placeId]);

  const isCurrent = enabled && state.placeId === placeId;

  return {
    place: isCurrent ? state.place : null,
    placeName: isCurrent ? (state.place?.name ?? null) : null,
    loading: enabled && !isCurrent,
  };
}
