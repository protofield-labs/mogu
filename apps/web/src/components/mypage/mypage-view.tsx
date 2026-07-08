"use client";

import { ArrowDownUp, MapPin, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { MoguBrandIcon } from "@/components/brand/mogu-brand-icon";
import { MypageViewSkeleton } from "@/components/loading/skeletons";
import {
  CollectionFormFields,
} from "@/components/mypage/collection-form-fields";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/card";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { CollectionGrid } from "@/components/mypage/collection-grid";
import { MypageAccountSheet } from "@/components/mypage/mypage-account-sheet";
import { MypageTopBar } from "@/components/mypage/mypage-top-bar";
import { NavRow } from "@/components/ui/nav-row";
import { ProfileHeroCard } from "@/components/mypage/profile-hero-card";
import { listMyCollections } from "@/lib/collections/browser-api";
import { useMe } from "@/lib/mypage/me-provider";
import { useMeBadges } from "@/lib/mypage/use-me-badges";
import { useMypageCollections } from "@/lib/mypage/use-mypage-collections";

export function MypageView() {
  const { me, loading: meLoading, error: meError, updateMe, refreshMe } = useMe();
  const { badges } = useMeBadges();
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const pendingFriendRequests = badges?.pendingFriendRequests ?? 0;

  const { setCollections, ...collectionsState } = useMypageCollections({
    initialCollections: [],
    updateMe,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadCollections() {
      setCollectionsLoading(true);
      setLoadError(null);
      try {
        const nextCollections = await listMyCollections();
        if (!cancelled) {
          setCollections(nextCollections);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "読み込みに失敗しました");
        }
      } finally {
        if (!cancelled) {
          setCollectionsLoading(false);
        }
      }
    }

    void loadCollections();
    return () => {
      cancelled = true;
    };
  }, [reloadToken, setCollections]);

  function handleRetryLoad() {
    setLoadError(null);
    setReloadToken((current) => current + 1);
    void refreshMe();
  }

  const loading = meLoading || collectionsLoading;

  if (loading) {
    return <MypageViewSkeleton />;
  }

  if (!me) {
    return (
      <LoadErrorState
        message={loadError ?? meError ?? "プロフィールを表示できませんでした"}
        onRetry={handleRetryLoad}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-5 pb-mogu-screen-y">
      <MypageTopBar />
      <ProfileHeroCard
        me={me}
        pendingFriendRequests={pendingFriendRequests}
      />

      <MypageAccountSheet
        me={me}
        onProfileUpdated={(profile) =>
          updateMe((current) => (current ? { ...current, ...profile } : current))
        }
      />

      {me.counts.spots > 0 ? (
        <section className="px-mogu-screen-x">
          <NavRow
            icon={MapPin}
            label="すべてのスポットを地図で見る"
            description={`${me.counts.spots} 件を俯瞰`}
            href="/mypage/map"
          />
        </section>
      ) : null}

      {me.counts.spots === 0 ? (
        <section className="px-mogu-screen-x">
          <NavRow
            iconSlot={<MoguBrandIcon className="size-5 text-foreground" />}
            label="最初のお店を記録しよう"
            description="記録が増えるほど、断言が鋭くなります"
            href="/search"
          />
        </section>
      ) : null}

      <section className="scroll-mt-4 space-y-3 px-mogu-screen-x pt-2">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
          <h2 className="shrink-0 whitespace-nowrap text-lg font-semibold text-foreground">
            コレクション
          </h2>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {collectionsState.collections.length > 1 ? (
              <button
                type="button"
                onClick={() =>
                  collectionsState.setReorderMode((current) => !current)
                }
                className="inline-flex items-center gap-1 rounded-full bg-mogu-surface-elevated px-3 py-1.5 text-xs font-medium shadow-sm transition-shadow hover:shadow-md"
              >
                <ArrowDownUp className="size-3.5" aria-hidden />
                {collectionsState.reorderMode ? "完了" : "並べ替え"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() =>
                collectionsState.setShowCreateForm((current) => !current)
              }
              className="inline-flex items-center gap-1 rounded-full bg-mogu-surface-elevated px-3 py-1.5 text-xs font-medium shadow-sm transition-shadow hover:shadow-md"
            >
              <Plus className="size-3.5" aria-hidden />
              新しいコレクション
            </button>
          </div>
        </div>
        {collectionsState.showCreateForm ? (
          <SurfaceCard className="p-4">
            <form
              className="space-y-3"
              onSubmit={(event) => void collectionsState.handleCreate(event)}
            >
              <CollectionFormFields
                form={collectionsState.createForm}
                onChange={collectionsState.setCreateForm}
              />
              {collectionsState.createError ? (
                <p className="text-sm text-destructive">
                  {collectionsState.createError}
                </p>
              ) : null}
              <Button type="submit" size="cta" disabled={collectionsState.busy}>
                作成する
              </Button>
            </form>
          </SurfaceCard>
        ) : null}
      </section>

      {collectionsState.collectionError ? (
        <p className="px-mogu-screen-x text-sm text-destructive">
          {collectionsState.collectionError}
        </p>
      ) : null}

      {loadError ? (
        <p className="px-mogu-screen-x text-sm text-destructive">{loadError}</p>
      ) : null}

      <CollectionGrid
        collections={collectionsState.collections}
        reorderMode={collectionsState.reorderMode}
        reorderBusy={collectionsState.busy}
        onMoveUp={(collection) => collectionsState.moveCollection(collection, "up")}
        onMoveDown={(collection) =>
          collectionsState.moveCollection(collection, "down")
        }
        onPinTop={collectionsState.pinCollectionToTop}
        showUpsell={!collectionsState.reorderMode}
      />
    </div>
  );
}
