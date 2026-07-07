"use client";

import { useEffect, useMemo } from "react";
import { APIProvider, Map, Marker, useMap } from "@vis.gl/react-google-maps";

import { CollectionSpotMapCard } from "@/components/collections/collection-spot-map-card";
import { EmptyState } from "@/components/ui/empty-state";
import { mapPinIcon } from "@/lib/collections/map-pin-icon";
import {
  DEFAULT_MAP_CENTER,
  readGoogleMapsApiKey,
} from "@/lib/places/maps-config";
import { usePlaceLocations } from "@/lib/places/use-place-locations";
import type { PlaceLocationDTO } from "@/lib/places/types";
import type { Spot } from "@/lib/spots/browser-api";

type CollectionSpotMapViewProps = {
  spots: Spot[];
  placeNames?: Record<string, string | null>;
  selectedSpotId: string | null;
  onSelectSpot: (spot: Spot) => void;
  onClearSelection: () => void;
  onOpenDetail?: (spot: Spot) => void;
  detailHrefForSpot?: (spot: Spot) => string;
};

type MapMarkerSpot = {
  spot: Spot;
  location: PlaceLocationDTO;
};

function computeMapViewport(points: Array<{ lat: number; lng: number }>): {
  center: { lat: number; lng: number };
  zoom: number;
} {
  if (points.length === 1) {
    return {
      center: { lat: points[0].lat, lng: points[0].lng },
      zoom: 15,
    };
  }

  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const center = {
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2,
  };
  const span = Math.max(maxLat - minLat, maxLng - minLng, 0.01);
  const zoom = Math.max(11, Math.min(15, Math.round(14 - Math.log2(span * 111))));

  return { center, zoom };
}

function FitMapViewport({ markerKey }: { markerKey: string }) {
  const map = useMap();

  useEffect(() => {
    if (!map || markerKey.length === 0) {
      return;
    }

    const points = markerKey.split("|").map((entry) => {
      const [lat, lng] = entry.split(",").map(Number);
      return { lat, lng };
    });
    if (points.length === 0 || points.some((point) => Number.isNaN(point.lat))) {
      return;
    }

    const viewport = computeMapViewport(points);
    map.setCenter(viewport.center);
    map.setZoom(viewport.zoom);
  }, [map, markerKey]);

  return null;
}

function buildMarkerSpots(
  spots: Spot[],
  locations: Record<string, PlaceLocationDTO>,
): MapMarkerSpot[] {
  return spots.flatMap((spot) => {
    const location = locations[spot.placeId];
    return location ? [{ spot, location }] : [];
  });
}

export function CollectionSpotMapView({
  spots,
  placeNames,
  selectedSpotId,
  onSelectSpot,
  onClearSelection,
  onOpenDetail,
  detailHrefForSpot,
}: CollectionSpotMapViewProps) {
  const mapsApiKey = readGoogleMapsApiKey();
  const placeIds = spots.map((spot) => spot.placeId);
  const { locations, loading, error } = usePlaceLocations(placeIds, spots.length > 0);
  const markers = useMemo(
    () => buildMarkerSpots(spots, locations),
    [spots, locations],
  );
  const markerKey = useMemo(
    () =>
      markers
        .map(({ location }) => `${location.lat},${location.lng}`)
        .sort()
        .join("|"),
    [markers],
  );
  const selectedSpot = spots.find((spot) => spot.id === selectedSpotId) ?? null;
  const selectedMarker =
    selectedSpot && locations[selectedSpot.placeId]
      ? { spot: selectedSpot, location: locations[selectedSpot.placeId] }
      : null;
  const initialViewport =
    markers.length > 0
      ? computeMapViewport(markers.map(({ location }) => location))
      : { center: DEFAULT_MAP_CENTER, zoom: 13 };

  if (!mapsApiKey) {
    return (
      <EmptyState className="rounded-2xl p-6">
        地図を表示するには Google Maps API キーの設定が必要です。
      </EmptyState>
    );
  }

  if (loading) {
    return (
      <div
        className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-border bg-muted/30"
        aria-busy="true"
      >
        <p className="text-sm text-muted-foreground">地図を読み込み中…</p>
      </div>
    );
  }

  // With cached pins available, keep the map visible even if a refetch failed.
  if (markers.length === 0) {
    return (
      <EmptyState className="rounded-2xl p-6">
        {error ?? "表示できる位置情報がありません。"}
      </EmptyState>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border">
      <APIProvider apiKey={mapsApiKey}>
        <Map
          defaultCenter={initialViewport.center}
          defaultZoom={initialViewport.zoom}
          gestureHandling="greedy"
          disableDefaultUI
          zoomControl
          className="aspect-[4/3] w-full"
          onClick={onClearSelection}
        >
          <FitMapViewport markerKey={markerKey} />
          {markers.map(({ spot, location }) => (
            <Marker
              key={spot.id}
              position={{ lat: location.lat, lng: location.lng }}
              onClick={(event) => {
                event.stop();
                onSelectSpot(spot);
              }}
              icon={mapPinIcon(spot.rating, selectedSpotId === spot.id)}
            />
          ))}
        </Map>
      </APIProvider>

      {selectedMarker ? (
        <CollectionSpotMapCard
          spot={selectedMarker.spot}
          placeName={placeNames?.[selectedMarker.spot.placeId] ?? selectedMarker.location.name}
          onOpenDetail={
            onOpenDetail ? () => onOpenDetail(selectedMarker.spot) : undefined
          }
          detailHref={detailHrefForSpot?.(selectedMarker.spot)}
          onClose={onClearSelection}
        />
      ) : null}
    </div>
  );
}
