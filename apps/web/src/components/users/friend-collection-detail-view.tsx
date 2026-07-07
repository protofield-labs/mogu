"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { CollectionSpotMapView } from "@/components/collections/collection-spot-map-view";
import {
  CollectionSpotViewTabs,
  type CollectionSpotViewMode,
} from "@/components/collections/collection-spot-view-tabs";
import { CollectionDetailSkeleton } from "@/components/loading/skeletons";
import { FriendSpotList } from "@/components/users/friend-spot-list";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { ShareButton } from "@/components/share/share-button";
import { getCollectionDetail } from "@/lib/collections/browser-api";
import { friendProfilePath } from "@/lib/friends/paths";
import { usePlaceNames } from "@/lib/places/use-place-names";
import { spotPath } from "@/lib/share/paths";
import { collectionShareUrl } from "@/lib/share/share-url";

type FriendCollectionDetailViewProps = {
  ownerId: string;
  collectionId: string;
};

export function FriendCollectionDetailView({
  ownerId,
  collectionId,
}: FriendCollectionDetailViewProps) {
  const [detail, setDetail] = useState<Awaited<
    ReturnType<typeof getCollectionDetail>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [spotViewMode, setSpotViewMode] = useState<CollectionSpotViewMode>("list");
  const [mapSelectedSpotId, setMapSelectedSpotId] = useState<string | null>(null);
  const [prevCollectionId, setPrevCollectionId] = useState(collectionId);

  const spotPlaceIds = useMemo(
    () => (detail?.spots ?? []).map((spot) => spot.placeId),
    [detail?.spots],
  );
  const placeNames = usePlaceNames(spotPlaceIds);

  if (collectionId !== prevCollectionId) {
    setPrevCollectionId(collectionId);
    setLoading(true);
    setLoadError(null);
    setDetail(null);
    setSpotViewMode("list");
    setMapSelectedSpotId(null);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const next = await getCollectionDetail(collectionId);
        if (!cancelled) {
          setDetail(next);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "読み込みに失敗しました",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [collectionId, reloadToken]);

  function handleRetryLoad() {
    setLoading(true);
    setLoadError(null);
    setReloadToken((current) => current + 1);
  }

  if (loading) {
    return <CollectionDetailSkeleton />;
  }

  if (!detail) {
    return (
      <LoadErrorState
        message={loadError ?? "コレクションを表示できませんでした"}
        onRetry={handleRetryLoad}
      />
    );
  }

  if (detail.ownerId !== ownerId) {
    return (
      <LoadErrorState
        message="このコレクションは表示できませんでした"
        onRetry={handleRetryLoad}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 pb-mogu-screen-y">
      <header className="flex items-center gap-3 px-mogu-screen-x pt-3">
        <Link
          href={friendProfilePath(ownerId)}
          className="flex size-9 items-center justify-center rounded-full border border-border bg-mogu-surface-elevated"
          aria-label="友達プロフィールに戻る"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-foreground">
            {detail.name}
          </h1>
          <p className="text-xs text-muted-foreground">{detail.spotCount}軒</p>
        </div>
        <ShareButton url={collectionShareUrl(collectionId)} />
      </header>

      <section className="space-y-3 px-mogu-screen-x">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">スポット一覧</h2>
          {detail.spots.length > 0 ? (
            <CollectionSpotViewTabs
              mode={spotViewMode}
              onChange={(mode) => {
                setSpotViewMode(mode);
                setMapSelectedSpotId(null);
              }}
            />
          ) : null}
        </div>
        {detail.spots.length === 0 ? (
          <FriendSpotList spots={detail.spots} />
        ) : spotViewMode === "map" ? (
          <CollectionSpotMapView
            spots={detail.spots}
            placeNames={placeNames}
            selectedSpotId={mapSelectedSpotId}
            onSelectSpot={(spot) => setMapSelectedSpotId(spot.id)}
            onClearSelection={() => setMapSelectedSpotId(null)}
            detailHrefForSpot={(spot) => spotPath(spot.id)}
          />
        ) : (
          <FriendSpotList spots={detail.spots} />
        )}
      </section>
    </div>
  );
}
