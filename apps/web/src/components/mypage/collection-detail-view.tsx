"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { CollectionDetailSkeleton } from "@/components/loading/skeletons";
import { CollectionCover } from "@/components/mypage/collection-cover";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SpotForm, SpotList } from "@/components/mypage/spot-form";
import { SpotDetailSheet } from "@/components/spots/spot-detail-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  getCollectionDetail,
  type CollectionDetail,
} from "@/lib/collections/browser-api";
import {
  filterCollectionSpots,
  type CollectionSpotRatingFilter,
} from "@/lib/collections/spot-filter";
import { pickAutoCoverUrls } from "@/lib/collections/cover";
import { googleMapsPlaceUrl } from "@/lib/agent/chat-helpers";
import { formatRatingChip } from "@/lib/home/feed-labels";
import { formatCollectionVisibility } from "@/lib/labels/collection-labels";
import { usePlace } from "@/lib/places/use-place";
import { usePlaceNames } from "@/lib/places/use-place-names";
import { deleteSpot, type Spot } from "@/lib/spots/browser-api";

const ratingFilterOptions: Array<{
  value: CollectionSpotRatingFilter;
  label: string;
}> = [
  { value: "all", label: "すべて" },
  { value: "again", label: formatRatingChip("again") },
  { value: "either", label: formatRatingChip("either") },
  { value: "no", label: formatRatingChip("no") },
];

type CollectionDetailViewProps = {
  collectionId: string;
  initialSpotId?: string | null;
};

export function CollectionDetailView({
  collectionId,
  initialSpotId = null,
}: CollectionDetailViewProps) {
  const [detail, setDetail] = useState<CollectionDetail | null>(null);
  const [editingSpot, setEditingSpot] = useState<Spot | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteSpotTarget, setDeleteSpotTarget] = useState<Spot | null>(null);
  const [deletingSpot, setDeletingSpot] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [spotSearchQuery, setSpotSearchQuery] = useState("");
  const [ratingFilter, setRatingFilter] =
    useState<CollectionSpotRatingFilter>("all");
  const [prevCollectionId, setPrevCollectionId] = useState(collectionId);
  const [prevInitialSpotId, setPrevInitialSpotId] = useState(initialSpotId);
  const formSectionRef = useRef<HTMLElement>(null);
  const initialSpotHandledRef = useRef(false);

  const { place, placeName } = usePlace(
    selectedSpot?.placeId ?? "",
    detailOpen && selectedSpot !== null,
  );
  const spotPlaceIds = useMemo(
    () => (detail?.spots ?? []).map((spot) => spot.placeId),
    [detail?.spots],
  );
  const placeNames = usePlaceNames(spotPlaceIds);
  const filteredSpots = useMemo(
    () =>
      filterCollectionSpots(
        detail?.spots ?? [],
        spotSearchQuery,
        ratingFilter,
        placeNames,
      ),
    [detail?.spots, spotSearchQuery, ratingFilter, placeNames],
  );

  if (collectionId !== prevCollectionId || initialSpotId !== prevInitialSpotId) {
    setPrevCollectionId(collectionId);
    setPrevInitialSpotId(initialSpotId);
    setLoading(true);
    setLoadError(null);
    setDetail(null);
    setEditingSpot(null);
    setSelectedSpot(null);
    setDetailOpen(false);
    setDeleteSpotTarget(null);
    setSpotSearchQuery("");
    setRatingFilter("all");
  }

  useEffect(() => {
    initialSpotHandledRef.current = false;
  }, [collectionId, initialSpotId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const next = await getCollectionDetail(collectionId);
        if (!cancelled) {
          setDetail(next);
          if (initialSpotId && !initialSpotHandledRef.current) {
            const spot = next.spots.find((item) => item.id === initialSpotId);
            if (spot) {
              initialSpotHandledRef.current = true;
              setSelectedSpot(spot);
              setDetailOpen(true);
            }
          }
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
  }, [collectionId, initialSpotId, reloadToken]);

  function handleSpotSaved(spot: Spot) {
    setDetail((current) => {
      if (!current) {
        return current;
      }
      const exists = current.spots.some((item) => item.id === spot.id);
      const spots = exists
        ? current.spots.map((item) => (item.id === spot.id ? spot : item))
        : [spot, ...current.spots];
      return {
        ...current,
        spotCount: exists ? current.spotCount : current.spotCount + 1,
        autoCoverUrls: current.coverUrl
          ? current.autoCoverUrls
          : pickAutoCoverUrls(spots),
        spots,
      };
    });
    setEditingSpot(null);
    setSelectedSpot((current) => (current?.id === spot.id ? spot : current));
  }

  function handleSelectSpot(spot: Spot) {
    setSelectedSpot(spot);
    setDetailOpen(true);
  }

  function handleCloseDetail() {
    setDetailOpen(false);
  }

  function handleEditFromDetail() {
    if (!selectedSpot) {
      return;
    }
    setDetailOpen(false);
    setEditingSpot(selectedSpot);
    formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleDeleteFromDetail() {
    if (!selectedSpot) {
      return;
    }
    setDetailOpen(false);
    setDeleteSpotTarget(selectedSpot);
  }

  async function handleConfirmDeleteSpot() {
    if (!deleteSpotTarget) {
      return;
    }

    const spot = deleteSpotTarget;
    setDeletingSpot(true);
    setError(null);
    try {
      await deleteSpot(spot.id);
      setDetail((current) =>
        current
          ? {
              ...current,
              spotCount: Math.max(0, current.spotCount - 1),
              spots: current.spots.filter((item) => item.id !== spot.id),
              autoCoverUrls: current.coverUrl
                ? current.autoCoverUrls
                : pickAutoCoverUrls(
                    current.spots.filter((item) => item.id !== spot.id),
                  ),
            }
          : current,
      );
      if (editingSpot?.id === spot.id) {
        setEditingSpot(null);
      }
      if (selectedSpot?.id === spot.id) {
        setSelectedSpot(null);
      }
      setDeleteSpotTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    } finally {
      setDeletingSpot(false);
    }
  }

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

  return (
    <div className="flex flex-1 flex-col gap-6 pb-mogu-screen-y">
      <header className="space-y-3 px-mogu-screen-x pt-3">
        <div className="flex items-center gap-3">
          <Link
            href="/mypage"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-mogu-surface-elevated"
            aria-label="マイページに戻る"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold text-foreground">
              {detail.name}
            </h1>
            <p className="text-xs text-muted-foreground">{detail.spotCount}軒</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pl-12">
          <Badge variant="accent">
            {formatCollectionVisibility(detail.visibility)}
          </Badge>
          {detail.theme ? (
            <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs text-muted-foreground">
              {detail.theme}
            </span>
          ) : null}
        </div>

        {detail.description ? (
          <p className="pl-12 text-sm text-muted-foreground">{detail.description}</p>
        ) : null}

        <div className="pl-12">
          <div className="relative aspect-[16/10] max-w-xs overflow-hidden rounded-2xl border border-border shadow-sm">
            <CollectionCover
              name={detail.name}
              coverUrl={detail.coverUrl}
              autoCoverUrls={detail.autoCoverUrls}
              className="size-full"
            />
          </div>
        </div>
      </header>

      <section ref={formSectionRef} className="space-y-3 px-mogu-screen-x">
        <SpotForm
          key={editingSpot?.id ?? "new"}
          collectionId={detail.id}
          editingSpot={editingSpot}
          onSaved={handleSpotSaved}
          onCancelEdit={() => setEditingSpot(null)}
        />
      </section>

      <section className="space-y-3 px-mogu-screen-x">
        <h2 className="text-sm font-semibold text-foreground">スポット一覧</h2>
        {detail.spots.length > 0 ? (
          <div className="space-y-3">
            <Input
              type="search"
              value={spotSearchQuery}
              onChange={(event) => setSpotSearchQuery(event.target.value)}
              placeholder="店名・タグ・一言で検索"
              aria-label="スポットを検索"
            />
            <div className="flex flex-wrap gap-2">
              {ratingFilterOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={ratingFilter === option.value ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => setRatingFilter(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {detail.spots.length === 0 ? (
          <EmptyState className="space-y-4 p-6">
            <p>まだスポットがありません。</p>
            <Link
              href="/search"
              className="inline-flex h-10 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              エージェントに相談して最初のスポットを追加
            </Link>
          </EmptyState>
        ) : filteredSpots.length === 0 ? (
          <EmptyState className="p-6">
            条件に合うスポットがありません。
          </EmptyState>
        ) : (
          <SpotList
            spots={filteredSpots}
            onSelect={handleSelectSpot}
            placeNames={placeNames}
          />
        )}
      </section>

      {selectedSpot ? (
        <SpotDetailSheet
          spot={selectedSpot}
          place={place}
          placeName={placeName}
          titleFallback={detail.name}
          open={detailOpen}
          onClose={handleCloseDetail}
          header={
            <p className="truncate text-sm font-medium text-foreground">
              {detail.name}
            </p>
          }
          footer={
            <div className="flex flex-wrap gap-2">
              <a
                href={googleMapsPlaceUrl(selectedSpot.placeId)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-7 items-center justify-center rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted hover:text-foreground"
              >
                地図で開く
              </a>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleEditFromDetail}
              >
                編集
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDeleteFromDetail}
              >
                削除
              </Button>
            </div>
          }
        />
      ) : null}

      <ConfirmDialog
        open={deleteSpotTarget !== null}
        title="スポットを削除"
        description="このスポットを削除しますか？この操作は元に戻せません。"
        confirmLabel="削除する"
        busy={deletingSpot}
        onConfirm={() => void handleConfirmDeleteSpot()}
        onCancel={() => setDeleteSpotTarget(null)}
      />
    </div>
  );
}
