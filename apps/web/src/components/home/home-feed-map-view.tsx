"use client";

import { useMemo, useState } from "react";

import { CollectionSpotMapView } from "@/components/collections/collection-spot-map-view";
import { FeedSpotDetailSheet } from "@/components/home/feed-spot-detail-sheet";
import { RecollectPicker } from "@/components/recollect/recollect-picker";
import { formatViaLabel } from "@/lib/home/feed-labels";
import type { FeedItem } from "@/lib/home/types";
import { usePlace } from "@/lib/places/use-place";
import { usePlaceNames } from "@/lib/places/use-place-names";
import { useRecollect } from "@/lib/recollect/use-recollect";
import type { Spot } from "@/lib/spots/browser-api";

type HomeFeedMapViewProps = {
  items: FeedItem[];
  viewerId?: string | null;
};

type HomeFeedMapDetailHostProps = {
  item: FeedItem;
  viewerId?: string | null;
  open: boolean;
  onClose: () => void;
};

function HomeFeedMapDetailHost({
  item,
  viewerId,
  open,
  onClose,
}: HomeFeedMapDetailHostProps) {
  const recollect = useRecollect(item.spot.id, { initialSaved: item.savedByMe });
  const { place, placeName } = usePlace(item.spot.placeId, open);

  return (
    <>
      <FeedSpotDetailSheet
        item={item}
        place={place}
        placeName={placeName}
        open={open}
        onClose={onClose}
        saved={recollect.saved}
        busy={recollect.busy}
        error={recollect.error}
        viewerId={viewerId}
        saveHandlers={recollect.saveHandlers}
      />
      <RecollectPicker spotId={item.spot.id} recollect={recollect} />
    </>
  );
}

export function HomeFeedMapView({ items, viewerId }: HomeFeedMapViewProps) {
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const spots = useMemo(() => items.map((item) => item.spot), [items]);
  const spotLabels = useMemo(
    () =>
      Object.fromEntries(
        items.map((item) => [item.spot.id, formatViaLabel(item.actor.displayName)]),
      ),
    [items],
  );
  const placeIds = useMemo(() => spots.map((spot) => spot.placeId), [spots]);
  const placeNames = usePlaceNames(placeIds);

  const selectedItem =
    items.find((item) => item.spot.id === selectedSpotId) ?? null;

  function handleSelectSpot(spot: Spot) {
    setSelectedSpotId(spot.id);
    setDetailOpen(true);
  }

  function handleCloseDetail() {
    setDetailOpen(false);
    setSelectedSpotId(null);
  }

  return (
    <>
      <CollectionSpotMapView
        spots={spots}
        placeNames={placeNames}
        spotLabels={spotLabels}
        selectedSpotId={selectedSpotId}
        onSelectSpot={handleSelectSpot}
        onClearSelection={() => {
          setSelectedSpotId(null);
          setDetailOpen(false);
        }}
        onOpenDetail={handleSelectSpot}
        showNearbyList={false}
        mapClassName="min-h-[min(55dvh,520px)] w-full"
      />

      {selectedItem && detailOpen ? (
        <HomeFeedMapDetailHost
          key={selectedItem.spot.id}
          item={selectedItem}
          viewerId={viewerId}
          open={detailOpen}
          onClose={handleCloseDetail}
        />
      ) : null}
    </>
  );
}
