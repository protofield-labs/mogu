"use client";

import { ChevronLeft, LocateFixed, Pencil, Plus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { CollectionSpotMapView } from "@/components/collections/collection-spot-map-view";
import {
  CollectionSpotViewTabs,
  type CollectionSpotViewMode,
} from "@/components/collections/collection-spot-view-tabs";
import { CollectionDetailSkeleton } from "@/components/loading/skeletons";
import { CollectionCoverPicker } from "@/components/mypage/collection-cover-picker";
import { CollectionCover } from "@/components/mypage/collection-cover";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SpotForm, SpotList } from "@/components/mypage/spot-form";
import { SpotDetailSheet } from "@/components/spots/spot-detail-sheet";
import { ShareButton } from "@/components/share/share-button";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetBody,
  SheetFooter,
  SheetHeader,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import {
  getCollectionDetail,
  updateCollection,
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
import { sortSpotsByDistance, spotDistanceLabels } from "@/lib/places/geo";
import { usePlace } from "@/lib/places/use-place";
import { usePlaceLocations } from "@/lib/places/use-place-locations";
import { usePlaceNames } from "@/lib/places/use-place-names";
import { useUserLocation } from "@/lib/places/use-user-location";
import { deleteSpot, type Spot } from "@/lib/spots/browser-api";
import { collectionShareUrl, spotShareUrl } from "@/lib/share/share-url";
import { cn } from "@/lib/utils";

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
  const [showSpotForm, setShowSpotForm] = useState(false);
  const [spotSearchQuery, setSpotSearchQuery] = useState("");
  const [ratingFilter, setRatingFilter] =
    useState<CollectionSpotRatingFilter>("all");
  const [spotViewMode, setSpotViewMode] = useState<CollectionSpotViewMode>("list");
  const [mapSelectedSpotId, setMapSelectedSpotId] = useState<string | null>(null);
  const [coverSheetOpen, setCoverSheetOpen] = useState(false);
  const [coverDraftUrl, setCoverDraftUrl] = useState<string | null>(null);
  const [coverSaving, setCoverSaving] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
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
  const userLocation = useUserLocation();
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
  const filteredPlaceIds = useMemo(
    () => filteredSpots.map((spot) => spot.placeId),
    [filteredSpots],
  );
  const { locations: spotLocations, loading: spotLocationsLoading, error: spotLocationsError } =
    usePlaceLocations(filteredPlaceIds, userLocation.location !== null);
  const locationPoints = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(spotLocations).map(([placeId, location]) => [
          placeId,
          { lat: location.lat, lng: location.lng },
        ]),
      ),
    [spotLocations],
  );
  const orderedSpots = useMemo(() => {
    if (!userLocation.location || spotLocationsLoading) {
      return filteredSpots;
    }
    return sortSpotsByDistance(filteredSpots, userLocation.location, locationPoints);
  }, [
    filteredSpots,
    userLocation.location,
    locationPoints,
    spotLocationsLoading,
  ]);
  const spotDistanceLabelsMap = useMemo(() => {
    if (!userLocation.location || spotLocationsLoading) {
      return {};
    }
    return spotDistanceLabels(orderedSpots, userLocation.location, locationPoints);
  }, [
    orderedSpots,
    userLocation.location,
    locationPoints,
    spotLocationsLoading,
  ]);
  const coverPhotoUrls = useMemo(
    () => [...new Set((detail?.spots ?? []).flatMap((spot) => spot.photoUrls))],
    [detail?.spots],
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
    setShowSpotForm(false);
    setSpotSearchQuery("");
    setRatingFilter("all");
    setSpotViewMode("list");
    setMapSelectedSpotId(null);
    setCoverSheetOpen(false);
    setCoverDraftUrl(null);
    setCoverSaving(false);
    setCoverError(null);
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
    setShowSpotForm(false);
    setSelectedSpot((current) => (current?.id === spot.id ? spot : current));
  }

  function handleOpenSpotForm() {
    setEditingSpot(null);
    setShowSpotForm(true);
  }

  function handleCancelSpotForm() {
    setEditingSpot(null);
    setShowSpotForm(false);
  }

  function handleSelectSpot(spot: Spot) {
    setSelectedSpot(spot);
    setDetailOpen(true);
  }

  function handleOpenSpotFromMap(spot: Spot) {
    setMapSelectedSpotId(spot.id);
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
    setShowSpotForm(true);
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

  function handleOpenCoverSheet() {
    if (!detail) {
      return;
    }
    setCoverDraftUrl(detail.coverUrl);
    setCoverError(null);
    setCoverSheetOpen(true);
  }

  async function handleSaveCover() {
    if (!detail) {
      return;
    }
    const collectionId = detail.id;
    setCoverSaving(true);
    setCoverError(null);
    try {
      const updated = await updateCollection(collectionId, {
        coverUrl: coverDraftUrl,
      });
      setDetail((current) =>
        current?.id === collectionId
          ? {
              ...current,
              coverUrl: updated.coverUrl,
            }
          : current,
      );
      setCoverSheetOpen(false);
    } catch (err) {
      setCoverError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setCoverSaving(false);
    }
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
          <ShareButton url={collectionShareUrl(collectionId)} />
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
          <button
            type="button"
            onClick={handleOpenCoverSheet}
            className="group relative aspect-[16/10] max-w-xs overflow-hidden rounded-2xl border border-border shadow-sm"
            aria-label="カバー画像を変更"
          >
            <CollectionCover
              name={detail.name}
              coverUrl={detail.coverUrl}
              autoCoverUrls={detail.autoCoverUrls}
              className="size-full transition-opacity group-hover:opacity-90"
            />
            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm">
              <Pencil className="size-3" aria-hidden />
              カバーを変更
            </span>
          </button>
        </div>
      </header>

      <section ref={formSectionRef} className="space-y-3 px-mogu-screen-x">
        {showSpotForm ? (
          <div className="space-y-2">
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancelSpotForm}
                className="text-muted-foreground"
              >
                <X className="size-4" aria-hidden />
                閉じる
              </Button>
            </div>
            <SpotForm
              key={editingSpot?.id ?? "new"}
              collectionId={detail.id}
              editingSpot={editingSpot}
              onSaved={handleSpotSaved}
              onCancelEdit={handleCancelSpotForm}
            />
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleOpenSpotForm}
          >
            <Plus className="size-4" aria-hidden />
            スポットを追加
          </Button>
        )}
      </section>

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
              <Button
                type="button"
                size="sm"
                variant={
                  userLocation.location && !spotLocationsLoading ? "default" : "outline"
                }
                className="rounded-full"
                disabled={userLocation.pending || spotLocationsLoading}
                aria-pressed={Boolean(userLocation.location && !spotLocationsLoading)}
                onClick={() => userLocation.requestLocation()}
              >
                {userLocation.pending ? (
                  <Spinner size="sm" />
                ) : (
                  <LocateFixed className="size-3.5" aria-hidden />
                )}
                現在地から近い順
              </Button>
            </div>
            {userLocation.error ? (
              <div className="rounded-mogu-card border border-destructive/20 bg-destructive/5 px-3 py-2.5">
                <p className="text-sm text-destructive">{userLocation.error}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => userLocation.requestLocation()}
                >
                  再試行
                </Button>
              </div>
            ) : null}
            {spotLocationsError && userLocation.location ? (
              <p className="text-sm text-destructive">{spotLocationsError}</p>
            ) : null}
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
        ) : spotViewMode === "map" ? (
          <CollectionSpotMapView
            spots={orderedSpots}
            placeNames={placeNames}
            userLocation={userLocation}
            selectedSpotId={mapSelectedSpotId}
            onSelectSpot={(spot) => setMapSelectedSpotId(spot.id)}
            onClearSelection={() => setMapSelectedSpotId(null)}
            onOpenDetail={handleOpenSpotFromMap}
          />
        ) : (
          <SpotList
            spots={orderedSpots}
            onSelect={handleSelectSpot}
            placeNames={placeNames}
            distanceLabels={spotDistanceLabelsMap}
          />
        )}
      </section>

      {selectedSpot ? (
        <SpotDetailSheet
          spot={selectedSpot}
          place={place}
          placeName={placeName}
          titleFallback={detail.name}
          distanceLabel={spotDistanceLabelsMap[selectedSpot.id] ?? null}
          open={detailOpen}
          onClose={handleCloseDetail}
          header={
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm text-muted-foreground">{detail.name}</p>
              <ShareButton url={spotShareUrl(selectedSpot.id)} className="ml-auto shrink-0" />
            </div>
          }
          footer={
            <>
              <a
                href={googleMapsPlaceUrl({
                  placeId: selectedSpot.placeId,
                  name: placeName,
                  location: place?.location,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "outline" }), "w-full")}
              >
                地図で開く
              </a>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={handleEditFromDetail}
              >
                編集
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={handleDeleteFromDetail}
              >
                削除
              </Button>
            </>
          }
        />
      ) : null}

      <Sheet open={coverSheetOpen} onClose={() => setCoverSheetOpen(false)}>
        <SheetHeader>カバー画像</SheetHeader>
        <SheetBody>
          <CollectionCoverPicker
            photoUrls={coverPhotoUrls}
            selectedUrl={coverDraftUrl}
            disabled={coverSaving}
            onSelect={setCoverDraftUrl}
          />
          {coverError ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {coverError}
            </p>
          ) : null}
        </SheetBody>
        <SheetFooter>
          <Button
            type="button"
            className="w-full"
            disabled={coverSaving}
            onClick={() => void handleSaveCover()}
          >
            {coverSaving ? (
              <>
                <Spinner size="sm" />
                保存中…
              </>
            ) : (
              "保存する"
            )}
          </Button>
        </SheetFooter>
      </Sheet>

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
