"use client";

import Link from "next/link";
import { ArrowDownUp, MapPin, Plus, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { MypageViewSkeleton } from "@/components/loading/skeletons";
import { CollectionCoverPicker } from "@/components/mypage/collection-cover-picker";
import {
  CollectionFormFields,
} from "@/components/mypage/collection-form-fields";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { CollectionGrid } from "@/components/mypage/collection-grid";
import { FlagInboxCard } from "@/components/mypage/flag-inbox-card";
import { MypageNavTiles } from "@/components/mypage/mypage-nav-tiles";
import { MypageTopBar } from "@/components/mypage/mypage-top-bar";
import { ProfileHeroCard } from "@/components/mypage/profile-hero-card";
import { listMyCollections } from "@/lib/collections/browser-api";
import { resolveDisplayCoverUrl } from "@/lib/collections/cover";
import { notifyBadgesUpdated } from "@/lib/mypage/badge-events";
import {
  fetchFlagNotifications,
  fetchMe,
  fetchMeBadges,
  markFlagsRead,
} from "@/lib/mypage/browser-api";
import { summarizeWeeklyFlags } from "@/lib/mypage/flag-inbox";
import { shouldShowFriendRequestBadge } from "@/lib/mypage/stats-row";
import { useMypageCollections } from "@/lib/mypage/use-mypage-collections";
import { touchCardClass } from "@/lib/ui/touch-feedback";
import { cn } from "@/lib/utils";

export function MypageView() {
  const [me, setMe] = useState<Awaited<ReturnType<typeof fetchMe>> | null>(null);
  const [pendingFriendRequests, setPendingFriendRequests] = useState(0);
  const [flagSummary, setFlagSummary] = useState(() =>
    summarizeWeeklyFlags([]),
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const collectionsRef = useRef<HTMLElement>(null);

  const { setCollections, ...collectionsState } = useMypageCollections({
    initialCollections: [],
    setMe,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [profile, nextCollections] = await Promise.all([
          fetchMe(),
          listMyCollections(),
        ]);

        if (cancelled) {
          return;
        }
        setMe(profile);
        setCollections(nextCollections);

        const [badgesResult, notificationsResult] = await Promise.allSettled([
          fetchMeBadges(),
          fetchFlagNotifications(),
        ]);

        if (cancelled) {
          return;
        }

        if (badgesResult.status === "fulfilled") {
          setPendingFriendRequests(badgesResult.value.pendingFriendRequests);
        }
        if (notificationsResult.status === "fulfilled") {
          setFlagSummary(summarizeWeeklyFlags(notificationsResult.value));
        }

        if (
          badgesResult.status === "fulfilled" &&
          badgesResult.value.unreadFlags > 0
        ) {
          try {
            await markFlagsRead();
            notifyBadgesUpdated();
          } catch {
            // Badge refresh is best-effort; inbox content remains visible.
          }
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "読み込みに失敗しました");
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
  }, [reloadToken, setCollections]);

  function handleRetryLoad() {
    setLoading(true);
    setLoadError(null);
    setReloadToken((current) => current + 1);
  }

  if (loading) {
    return <MypageViewSkeleton />;
  }

  if (!me) {
    return (
      <LoadErrorState
        message={loadError ?? "プロフィールを表示できませんでした"}
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
        onProfileUpdated={(profile) =>
          setMe((current) => (current ? { ...current, ...profile } : current))
        }
      />

      <MypageNavTiles
        collectionCount={me.counts.collections}
        friendCount={me.counts.friends}
        showFriendBadge={shouldShowFriendRequestBadge(pendingFriendRequests)}
        coverUrl={
          resolveDisplayCoverUrl(
            collectionsState.collections.find((collection) =>
              collection.coverUrl || collection.autoCoverUrls.length > 0,
            ) ?? { coverUrl: null, autoCoverUrls: [] },
          )
        }
        onCollectionsClick={() =>
          collectionsRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          })
        }
      />

      {me.counts.spots > 0 ? (
        <section className="px-mogu-screen-x">
          <Link
            href="/mypage/map"
            className={cn(
              "flex items-center gap-4 rounded-mogu-card bg-mogu-surface-elevated p-4 shadow-sm transition-shadow hover:shadow-md",
              touchCardClass,
            )}
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-muted to-background">
              <MapPin className="size-5 text-foreground" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">
                すべてのスポットを地図で見る
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {me.counts.spots} 件を俯瞰
              </span>
            </span>
          </Link>
        </section>
      ) : null}

      <FlagInboxCard summary={flagSummary} />

      {me.counts.spots === 0 ? (
        <section className="px-mogu-screen-x">
          <Link
            href="/search"
            className="flex items-center gap-4 rounded-mogu-card bg-mogu-surface-elevated p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-muted to-background">
              <Sparkles className="size-5 text-foreground" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">
                最初のお店を記録しよう
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                記録が増えるほど、断言が鋭くなります
              </span>
            </span>
          </Link>
        </section>
      ) : null}

      <section
        ref={collectionsRef}
        className="scroll-mt-4 space-y-3 px-mogu-screen-x pt-2"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">コレクション</h2>
          <div className="flex items-center gap-2">
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

      {collectionsState.editingCollection ? (
        <section className="space-y-3 px-mogu-screen-x">
          <h2 className="text-sm font-semibold text-foreground">
            「{collectionsState.editingCollection.name}」を編集
          </h2>
          <SurfaceCard className="p-4">
            <form
              className="space-y-3"
              onSubmit={(event) => void collectionsState.handleSaveEdit(event)}
            >
              <CollectionFormFields
                form={collectionsState.editForm}
                onChange={collectionsState.setEditForm}
              />
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">カバー画像</p>
                {collectionsState.loadingEditPhotos ? (
                  <p className="text-xs text-muted-foreground">写真を読み込み中…</p>
                ) : (
                  <CollectionCoverPicker
                    photoUrls={collectionsState.editPhotoUrls}
                    selectedUrl={collectionsState.editCoverUrl}
                    disabled={collectionsState.busy}
                    onSelect={collectionsState.setEditCoverUrl}
                  />
                )}
              </div>
              {collectionsState.collectionError ? (
                <p className="text-sm text-destructive">
                  {collectionsState.collectionError}
                </p>
              ) : null}
              <div className="flex gap-2">
                <Button
                  type="submit"
                  className="h-10 flex-1 rounded-2xl"
                  disabled={collectionsState.busy}
                >
                  保存
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 flex-1 rounded-2xl"
                  disabled={collectionsState.busy}
                  onClick={() => collectionsState.setEditingCollection(null)}
                >
                  キャンセル
                </Button>
              </div>
            </form>
          </SurfaceCard>
        </section>
      ) : null}

      {collectionsState.collectionError && !collectionsState.editingCollection ? (
        <p className="px-mogu-screen-x text-sm text-destructive">
          {collectionsState.collectionError}
        </p>
      ) : null}

      <CollectionGrid
        collections={collectionsState.collections}
        onEdit={
          collectionsState.reorderMode ? undefined : collectionsState.startEdit
        }
        onDelete={
          collectionsState.reorderMode ? undefined : collectionsState.setDeleteTarget
        }
        reorderMode={collectionsState.reorderMode}
        reorderBusy={collectionsState.busy}
        onMoveUp={(collection) => collectionsState.moveCollection(collection, "up")}
        onMoveDown={(collection) =>
          collectionsState.moveCollection(collection, "down")
        }
        onPinTop={collectionsState.pinCollectionToTop}
        showUpsell={!collectionsState.reorderMode}
      />

      <ConfirmDialog
        open={collectionsState.deleteTarget !== null}
        title="コレクションを削除"
        description={
          collectionsState.deleteTarget
            ? `「${collectionsState.deleteTarget.name}」を削除しますか？この操作は元に戻せません。`
            : ""
        }
        confirmLabel="削除する"
        busy={collectionsState.busy}
        onConfirm={() => void collectionsState.handleConfirmDeleteCollection()}
        onCancel={() => collectionsState.setDeleteTarget(null)}
      />
    </div>
  );
}
