"use client";

import { useMemo, useState } from "react";

import { CollectionSpotMapView } from "@/components/collections/collection-spot-map-view";
import { FeedSpotDetailSheet } from "@/components/home/feed-spot-detail-sheet";
import { SpotSaveFooter } from "@/components/recollect/spot-save-footer";
import { formatViaLabel } from "@/lib/home/feed-labels";
import { canRecollectFeedItem } from "@/lib/home/feed-item";
import type { FeedItem } from "@/lib/home/types";
import { usePlace } from "@/lib/places/use-place";
import { usePlaceNames } from "@/lib/places/use-place-names";
import { useRecollect } from "@/lib/recollect/use-recollect";
import type { Spot } from "@/lib/spots/browser-api";

type HomeFeedMapViewProps = {
  items: FeedItem[];
  viewerId?: string | null;
  /** Keeps item.savedByMe in sync in the feed owner across remounts (#283). */
  onSavedChange?: (
    spotId: string,
    saved: boolean,
    savedCount: number | null,
  ) => void;
};

type HomeFeedMapDetailHostProps = {
  item: FeedItem;
  viewerId?: string | null;
  open: boolean;
  onClose: () => void;
  onSavedChange?: (saved: boolean, savedCount: number | null) => void;
};

function HomeFeedMapDetailHost({
  item,
  viewerId,
  open,
  onClose,
  onSavedChange,
}: HomeFeedMapDetailHostProps) {
  const recollect = useRecollect(item.spot.id, {
    initialSaved: item.savedByMe,
    onSavedChange,
  });
  const { place, placeName } = usePlace(item.spot.placeId, open);
  const showSaveActions = canRecollectFeedItem(item, viewerId);

  return (
    <SpotSaveFooter spotId={item.spot.id} recollect={recollect}>
      <FeedSpotDetailSheet
        item={item}
        place={place}
        placeName={placeName}
        open={open}
        onClose={onClose}
        viewerId={viewerId}
        showSaveActions={showSaveActions}
        recollect={recollect}
      />
      {showSaveActions ? <SpotSaveFooter.Picker /> : null}
    </SpotSaveFooter>
  );
}

export function HomeFeedMapView({
  items,
  viewerId,
  onSavedChange,
}: HomeFeedMapViewProps) {
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
        mapClassName="h-[min(55dvh,520px)] w-full"
      />

      {selectedItem && detailOpen ? (
        <HomeFeedMapDetailHost
          key={selectedItem.spot.id}
          item={selectedItem}
          viewerId={viewerId}
          open={detailOpen}
          onClose={handleCloseDetail}
          onSavedChange={
            onSavedChange
              ? (saved, savedCount) =>
                  onSavedChange(selectedItem.spot.id, saved, savedCount)
              : undefined
          }
        />
      ) : null}
    </>
  );
}
