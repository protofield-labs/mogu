"use client";

import Link from "next/link";
import { ArrowDownUp, Plus, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { MypageViewSkeleton } from "@/components/loading/skeletons";
import { CollectionCoverPicker } from "@/components/mypage/collection-cover-picker";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { Textarea } from "@/components/ui/textarea";
import { CollectionGrid } from "@/components/mypage/collection-grid";
import { FlagInboxCard } from "@/components/mypage/flag-inbox-card";
import { MypageNavTiles } from "@/components/mypage/mypage-nav-tiles";
import { MypageTopBar } from "@/components/mypage/mypage-top-bar";
import { ProfileHeroCard } from "@/components/mypage/profile-hero-card";
import {
  createCollection,
  deleteCollection,
  getCollectionDetail,
  listMyCollections,
  reorderMyCollections,
  updateCollection,
  type Collection,
  type CollectionVisibility,
} from "@/lib/collections/browser-api";
import { resolveDisplayCoverUrl } from "@/lib/collections/cover";
import { formatCollectionVisibility } from "@/lib/labels/collection-labels";
import { notifyBadgesUpdated } from "@/lib/mypage/badge-events";
import {
  fetchFlagNotifications,
  fetchMe,
  fetchMeBadges,
  markFlagsRead,
} from "@/lib/mypage/browser-api";
import { summarizeWeeklyFlags } from "@/lib/mypage/flag-inbox";
import { shouldShowFriendRequestBadge } from "@/lib/mypage/stats-row";

type CollectionForm = {
  name: string;
  description: string;
  visibility: CollectionVisibility;
  theme: string;
};

const emptyForm: CollectionForm = {
  name: "",
  description: "",
  visibility: "friends",
  theme: "",
};

export function MypageView() {
  const [me, setMe] = useState<Awaited<ReturnType<typeof fetchMe>> | null>(null);
  const [pendingFriendRequests, setPendingFriendRequests] = useState(0);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [flagSummary, setFlagSummary] = useState(() =>
    summarizeWeeklyFlags([]),
  );
  const [createForm, setCreateForm] = useState<CollectionForm>(emptyForm);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [editForm, setEditForm] = useState<CollectionForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null);
  const [editCoverUrl, setEditCoverUrl] = useState<string | null>(null);
  const [editPhotoUrls, setEditPhotoUrls] = useState<string[]>([]);
  const [loadingEditPhotos, setLoadingEditPhotos] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const collectionsRef = useRef<HTMLElement>(null);
  const editPhotosRequestRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Profile + collections are required; badges / flags degrade gracefully.
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
          setError(err instanceof Error ? err.message : "読み込みに失敗しました");
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
  }, [reloadToken]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const collection = await createCollection({
        name: createForm.name.trim(),
        visibility: createForm.visibility,
        ...(createForm.description.trim()
          ? { description: createForm.description }
          : {}),
        ...(createForm.theme.trim() ? { theme: createForm.theme } : {}),
      });
      setCollections((current) => [...current, collection]);
      setCreateForm(emptyForm);
      setShowCreateForm(false);
      setMe((current) =>
        current
          ? {
              ...current,
              counts: {
                ...current.counts,
                collections: current.counts.collections + 1,
              },
            }
          : current,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "作成に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(collection: Collection) {
    const requestId = ++editPhotosRequestRef.current;
    setEditingCollection(collection);
    setEditForm({
      name: collection.name,
      description: collection.description ?? "",
      visibility: collection.visibility,
      theme: collection.theme ?? "",
    });
    setEditCoverUrl(collection.coverUrl);
    setEditPhotoUrls([]);
    setLoadingEditPhotos(true);
    void getCollectionDetail(collection.id)
      .then((detail) => {
        if (editPhotosRequestRef.current !== requestId) {
          return;
        }
        const urls = detail.spots.flatMap((spot) => spot.photoUrls);
        setEditPhotoUrls([...new Set(urls)]);
      })
      .catch(() => {
        if (editPhotosRequestRef.current !== requestId) {
          return;
        }
        setEditPhotoUrls([]);
      })
      .finally(() => {
        if (editPhotosRequestRef.current !== requestId) {
          return;
        }
        setLoadingEditPhotos(false);
      });
  }

  async function persistCollectionOrder(nextCollections: Collection[]) {
    if (busy) {
      return;
    }
    setBusy(true);
    setCollectionError(null);
    try {
      const reordered = await reorderMyCollections(
        nextCollections.map((collection) => collection.id),
      );
      setCollections(reordered);
    } catch (err) {
      setCollectionError(err instanceof Error ? err.message : "並べ替えに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  function moveCollection(collection: Collection, direction: "up" | "down") {
    if (busy) {
      return;
    }
    const index = collections.findIndex((item) => item.id === collection.id);
    if (index < 0) {
      return;
    }
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= collections.length) {
      return;
    }
    const next = [...collections];
    const [removed] = next.splice(index, 1);
    next.splice(targetIndex, 0, removed!);
    void persistCollectionOrder(next);
  }

  function pinCollectionToTop(collection: Collection) {
    if (busy) {
      return;
    }
    const next = [
      collection,
      ...collections.filter((item) => item.id !== collection.id),
    ];
    void persistCollectionOrder(next);
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCollection) {
      return;
    }

    setBusy(true);
    setCollectionError(null);
    try {
      const collection = await updateCollection(editingCollection.id, {
        name: editForm.name.trim(),
        description: editForm.description.trim() ? editForm.description : null,
        visibility: editForm.visibility,
        theme: editForm.theme.trim() ? editForm.theme : null,
        coverUrl: editCoverUrl,
      });
      setCollections((current) =>
        current.map((item) => (item.id === collection.id ? collection : item)),
      );
      setEditingCollection(null);
    } catch (err) {
      setCollectionError(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmDeleteCollection() {
    if (!deleteTarget) {
      return;
    }

    const collection = deleteTarget;
    setBusy(true);
    setCollectionError(null);
    try {
      await deleteCollection(collection.id);
      setCollections((current) =>
        current.filter((item) => item.id !== collection.id),
      );
      setMe((current) =>
        current
          ? {
              ...current,
              counts: {
                ...current.counts,
                collections: Math.max(0, current.counts.collections - 1),
              },
            }
          : current,
      );
      setDeleteTarget(null);
    } catch (err) {
      setCollectionError(err instanceof Error ? err.message : "削除に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  function handleRetryLoad() {
    setLoading(true);
    setError(null);
    setReloadToken((current) => current + 1);
  }

  if (loading) {
    return <MypageViewSkeleton />;
  }

  if (!me) {
    return (
      <LoadErrorState
        message={error ?? "プロフィールを表示できませんでした"}
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
            collections.find((collection) =>
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
            {collections.length > 1 ? (
              <button
                type="button"
                onClick={() => setReorderMode((current) => !current)}
                className="inline-flex items-center gap-1 rounded-full bg-mogu-surface-elevated px-3 py-1.5 text-xs font-medium shadow-sm transition-shadow hover:shadow-md"
              >
                <ArrowDownUp className="size-3.5" aria-hidden />
                {reorderMode ? "完了" : "並べ替え"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setShowCreateForm((current) => !current)}
              className="inline-flex items-center gap-1 rounded-full bg-mogu-surface-elevated px-3 py-1.5 text-xs font-medium shadow-sm transition-shadow hover:shadow-md"
            >
              <Plus className="size-3.5" aria-hidden />
              新しいコレクション
            </button>
          </div>
        </div>
        {showCreateForm ? (
          <SurfaceCard className="p-4">
            <form
              className="space-y-3"
              onSubmit={(event) => void handleCreate(event)}
            >
              <CollectionFormFields form={createForm} onChange={setCreateForm} />
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" size="cta" disabled={busy}>
                作成する
              </Button>
            </form>
          </SurfaceCard>
        ) : null}
      </section>

      {editingCollection ? (
        <section className="space-y-3 px-mogu-screen-x">
          <h2 className="text-sm font-semibold text-foreground">
            「{editingCollection.name}」を編集
          </h2>
          <SurfaceCard className="p-4">
            <form
              className="space-y-3"
              onSubmit={(event) => void handleSaveEdit(event)}
            >
              <CollectionFormFields form={editForm} onChange={setEditForm} />
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">カバー画像</p>
                {loadingEditPhotos ? (
                  <p className="text-xs text-muted-foreground">写真を読み込み中…</p>
                ) : (
                  <CollectionCoverPicker
                    photoUrls={editPhotoUrls}
                    selectedUrl={editCoverUrl}
                    disabled={busy}
                    onSelect={setEditCoverUrl}
                  />
                )}
              </div>
              {collectionError ? (
                <p className="text-sm text-destructive">{collectionError}</p>
              ) : null}
              <div className="flex gap-2">
                <Button type="submit" className="h-10 flex-1 rounded-2xl" disabled={busy}>
                  保存
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 flex-1 rounded-2xl"
                  disabled={busy}
                  onClick={() => setEditingCollection(null)}
                >
                  キャンセル
                </Button>
              </div>
            </form>
          </SurfaceCard>
        </section>
      ) : null}

      {collectionError && !editingCollection ? (
        <p className="px-mogu-screen-x text-sm text-destructive">{collectionError}</p>
      ) : null}

      <CollectionGrid
        collections={collections}
        onEdit={reorderMode ? undefined : startEdit}
        onDelete={reorderMode ? undefined : setDeleteTarget}
        reorderMode={reorderMode}
        reorderBusy={busy}
        onMoveUp={(collection) => moveCollection(collection, "up")}
        onMoveDown={(collection) => moveCollection(collection, "down")}
        onPinTop={pinCollectionToTop}
        showUpsell={!reorderMode}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="コレクションを削除"
        description={
          deleteTarget
            ? `「${deleteTarget.name}」を削除しますか？この操作は元に戻せません。`
            : ""
        }
        confirmLabel="削除する"
        busy={busy}
        onConfirm={() => void handleConfirmDeleteCollection()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function CollectionFormFields({
  form,
  onChange,
}: {
  form: CollectionForm;
  onChange: (next: CollectionForm) => void;
}) {
  return (
    <div className="space-y-3">
      <Label>
        <span>名前</span>
        <Input
          type="text"
          required
          maxLength={80}
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
          placeholder="週末に行きたい店"
        />
      </Label>
      <Label>
        <span>説明</span>
        <Textarea
          maxLength={240}
          value={form.description}
          onChange={(event) =>
            onChange({ ...form, description: event.target.value })
          }
          placeholder="どんなコレクションかメモ"
        />
      </Label>
      <div className="grid grid-cols-2 gap-3">
        <Label>
          <span>公開範囲</span>
          <Select
            value={form.visibility}
            onChange={(event) =>
              onChange({
                ...form,
                visibility: event.target.value as CollectionVisibility,
              })
            }
          >
            <option value="friends">{formatCollectionVisibility("friends")}</option>
            <option value="secret">{formatCollectionVisibility("secret")}</option>
          </Select>
        </Label>
        <Label>
          <span>テーマ</span>
          <Input
            type="text"
            maxLength={80}
            value={form.theme}
            onChange={(event) => onChange({ ...form, theme: event.target.value })}
            placeholder="デート"
          />
        </Label>
      </div>
    </div>
  );
}
