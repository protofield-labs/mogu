"use client";

import { useCallback, useState } from "react";

import type { GeoPoint } from "@/lib/places/geo";

export type UserGeoPoint = GeoPoint & {
  accuracy?: number;
};

type UserLocationState = {
  location: UserGeoPoint | null;
  error: string | null;
  pending: boolean;
};

function geolocationErrorMessage(code: number): string {
  if (code === 1) {
    return "位置情報の許可が必要です。ブラウザの設定で許可してください";
  }
  if (code === 2) {
    return "現在地を特定できませんでした";
  }
  if (code === 3) {
    return "現在地の取得がタイムアウトしました。もう一度お試しください";
  }
  return "現在地を取得できませんでした";
}

/** Browser geolocation for map nearby sorting (#181). Client-only; never sent to server. */
export function useUserLocation() {
  const [state, setState] = useState<UserLocationState>({
    location: null,
    error: null,
    pending: false,
  });

  const requestLocation = useCallback((onSuccess?: (location: UserGeoPoint) => void) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((current) => ({
        ...current,
        error: "この端末では位置情報を利用できません",
      }));
      return;
    }

    setState((current) => ({ ...current, pending: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location: UserGeoPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setState({
          location,
          error: null,
          pending: false,
        });
        onSuccess?.(location);
      },
      (error) => {
        setState((current) => ({
          ...current,
          pending: false,
          error: geolocationErrorMessage(error.code),
        }));
      },
      {
        enableHighAccuracy: false,
        timeout: 20_000,
        maximumAge: 120_000,
      },
    );
  }, []);

  return {
    location: state.location,
    error: state.error,
    pending: state.pending,
    requestLocation,
  };
}
