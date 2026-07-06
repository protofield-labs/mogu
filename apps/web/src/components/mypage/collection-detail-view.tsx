"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { CollectionDetailSkeleton } from "@/components/loading/skeletons";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { SpotForm, SpotList } from "@/components/mypage/spot-form";
import {
  getCollectionDetail,
  type CollectionDetail,
} from "@/lib/collections/browser-api";
import { deleteSpot, type Spot } from "@/lib/spots/browser-api";

type CollectionDetailViewProps = {
  collectionId: string;
};

export function CollectionDetailView({ collectionId }: CollectionDetailViewProps) {
  const [detail, setDetail] = useState<CollectionDetail | null>(null);
  const [editingSpot, setEditingSpot] = useState<Spot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [prevCollectionId, setPrevCollectionId] = useState(collectionId);

  if (collectionId !== prevCollectionId) {
    setPrevCollectionId(collectionId);
    setLoading(true);
    setLoadError(null);
    setDetail(null);
    setEditingSpot(null);
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
        spots,
      };
    });
    setEditingSpot(null);
  }

  async function handleDeleteSpot(spot: Spot) {
    if (!window.confirm("このスポットを削除しますか？")) {
      return;
    }
    try {
      await deleteSpot(spot.id);
      setDetail((current) =>
        current
          ? {
              ...current,
              spotCount: Math.max(0, current.spotCount - 1),
              spots: current.spots.filter((item) => item.id !== spot.id),
            }
          : current,
      );
      if (editingSpot?.id === spot.id) {
        setEditingSpot(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
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
      <header className="flex items-center gap-3 px-mogu-screen-x pt-3">
        <Link
          href="/mypage"
          className="flex size-9 items-center justify-center rounded-full border border-border bg-mogu-surface-elevated"
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
      </header>

      <section className="space-y-3 px-mogu-screen-x">
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
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <SpotList
          spots={detail.spots}
          onEdit={setEditingSpot}
          onDelete={(spot) => void handleDeleteSpot(spot)}
        />
      </section>
    </div>
  );
}
