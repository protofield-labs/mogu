"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Marker, useMap } from "@vis.gl/react-google-maps";
import { toast } from "sonner";

import { CollectionSpotMapCard } from "@/components/collections/collection-spot-map-card";
import {
  MapApiProvider,
  MonitoredMap,
} from "@/components/collections/map-api-provider";
import { MapCurrentLocationButton } from "@/components/collections/map-current-location-button";
import { MapNearbySpotList } from "@/components/collections/map-nearby-spot-list";
import { EmptyState } from "@/components/ui/empty-state";
import { mapPinIcon } from "@/lib/collections/map-pin-icon";
import {
  sortSpotsByDistance,
  spotDistanceLabels,
  type GeoPoint,
} from "@/lib/places/geo";
import {
  DEFAULT_MAP_CENTER,
  readGoogleMapsApiKey,
} from "@/lib/places/maps-config";
import { MAPS_LOAD_ERROR_MESSAGE } from "@/lib/places/maps-load-error";
import { usePlaceLocations } from "@/lib/places/use-place-locations";
import { useUserLocation } from "@/lib/places/use-user-location";
import type { UserGeoPoint } from "@/lib/places/use-user-location";
import { userLocationMarkerIcon } from "@/lib/places/user-location-marker";
import type { PlaceLocationDTO } from "@/lib/places/types";
import type { Spot } from "@/lib/spots/browser-api";
import { cn } from "@/lib/utils";

type UserLocationControl = ReturnType<typeof useUserLocation>;

type CollectionSpotMapViewProps = {
  spots: Spot[];
  placeNames?: Record<string, string | null>;
  spotLabels?: Record<string, string>;
  selectedSpotId: string | null;
  onSelectSpot: (spot: Spot) => void;
  onClearSelection: () => void;
  onOpenDetail?: (spot: Spot) => void;
  detailHrefForSpot?: (spot: Spot) => string;
  mapClassName?: string;
  /** Show nearby list after user grants location (default true). */
  showNearbyList?: boolean;
  /** Share geolocation state with a parent (e.g. list/map tabs). */
  userLocation?: UserLocationControl;
};

type MapMarkerSpot = {
  spot: Spot;
  location: PlaceLocationDTO;
};

type PanTarget = GeoPoint & { key: number };

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

function FitMapViewport({
  markerKey,
  enabled,
}: {
  markerKey: string;
  enabled: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!enabled || !map || markerKey.length === 0) {
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
  }, [map, markerKey, enabled]);

  return null;
}

function PanMapToTarget({ target }: { target: PanTarget | null }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !target) {
      return;
    }
    map.panTo({ lat: target.lat, lng: target.lng });
    map.setZoom(15);
  }, [map, target]);

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
  spotLabels,
  selectedSpotId,
  onSelectSpot,
  onClearSelection,
  onOpenDetail,
  detailHrefForSpot,
  mapClassName = "aspect-[4/3] w-full",
  showNearbyList = true,
  userLocation: userLocationProp,
}: CollectionSpotMapViewProps) {
  const mapsApiKey = readGoogleMapsApiKey();
  const internalUserLocation = useUserLocation();
  const userLocation = userLocationProp ?? internalUserLocation;
  const [panTarget, setPanTarget] = useState<PanTarget | null>(null);
  const [focusUserLocation, setFocusUserLocation] = useState(false);
  const [mapsLoadError, setMapsLoadError] = useState<string | null>(null);
  const mapsErrorReportedRef = useRef(false);
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
  const locationPoints = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(locations).map(([placeId, location]) => [
          placeId,
          { lat: location.lat, lng: location.lng },
        ]),
      ),
    [locations],
  );
  const nearbySpots = useMemo(
    () => sortSpotsByDistance(spots, userLocation.location, locationPoints),
    [spots, userLocation.location, locationPoints],
  );
  const distanceLabels = useMemo(
    () => spotDistanceLabels(nearbySpots, userLocation.location, locationPoints),
    [nearbySpots, userLocation.location, locationPoints],
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

  useEffect(() => {
    if (!userLocation.error) {
      return;
    }
    toast.error(userLocation.error);
  }, [userLocation.error]);

  function panToLocation(location: UserGeoPoint) {
    setFocusUserLocation(true);
    setPanTarget({
      lat: location.lat,
      lng: location.lng,
      key: Date.now(),
    });
  }

  function handleRequestCurrentLocation() {
    if (userLocation.location) {
      panToLocation(userLocation.location);
      return;
    }
    userLocation.requestLocation(panToLocation);
  }

  const handleMapsLoadError = useCallback((message: string) => {
    if (mapsErrorReportedRef.current) {
      return;
    }
    mapsErrorReportedRef.current = true;
    setMapsLoadError(message);
  }, []);

  if (!mapsApiKey) {
    return (
      <EmptyState className="rounded-2xl p-6">
        {MAPS_LOAD_ERROR_MESSAGE.missingKey}
      </EmptyState>
    );
  }

  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-2xl border border-border bg-muted/30",
          mapClassName,
        )}
        aria-busy="true"
      >
        <p className="text-sm text-muted-foreground">地図を読み込み中…</p>
      </div>
    );
  }

  if (markers.length === 0) {
    return (
      <EmptyState className="rounded-2xl p-6">
        {error ?? "表示できる位置情報がありません。"}
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-border">
        {mapsLoadError ? (
          <EmptyState className={cn("rounded-none p-6", mapClassName)}>
            {mapsLoadError}
          </EmptyState>
        ) : (
          <MapApiProvider apiKey={mapsApiKey} onLoadError={handleMapsLoadError}>
            <MonitoredMap
              defaultCenter={initialViewport.center}
              defaultZoom={initialViewport.zoom}
              gestureHandling="greedy"
              disableDefaultUI
              zoomControl
              className={mapClassName}
              onClick={onClearSelection}
              onLoadError={handleMapsLoadError}
            >
              <FitMapViewport markerKey={markerKey} enabled={!focusUserLocation} />
              <PanMapToTarget target={panTarget} />
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
              {userLocation.location ? (
                <Marker
                  position={{
                    lat: userLocation.location.lat,
                    lng: userLocation.location.lng,
                  }}
                  icon={userLocationMarkerIcon()}
                  zIndex={1000}
                />
              ) : null}
            </MonitoredMap>
          </MapApiProvider>
        )}

        {!mapsLoadError ? (
          <MapCurrentLocationButton
            pending={userLocation.pending}
            active={userLocation.location !== null}
            onClick={handleRequestCurrentLocation}
          />
        ) : null}

        {!mapsLoadError && selectedMarker ? (
          <CollectionSpotMapCard
            spot={selectedMarker.spot}
            placeName={
              placeNames?.[selectedMarker.spot.placeId] ?? selectedMarker.location.name
            }
            collectionLabel={spotLabels?.[selectedMarker.spot.id]}
            onOpenDetail={
              onOpenDetail ? () => onOpenDetail(selectedMarker.spot) : undefined
            }
            detailHref={detailHrefForSpot?.(selectedMarker.spot)}
            onClose={onClearSelection}
          />
        ) : null}
      </div>

      {showNearbyList && userLocation.location ? (
        <MapNearbySpotList
          spots={nearbySpots}
          placeNames={placeNames}
          spotLabels={spotLabels}
          distanceLabels={distanceLabels}
          selectedSpotId={selectedSpotId}
          onSelectSpot={onSelectSpot}
        />
      ) : null}
    </div>
  );
}
