"use client";

import { Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { MypageViewSkeleton } from "@/components/loading/skeletons";
import { CollectionGrid } from "@/components/mypage/collection-grid";
import { FlagInboxCard } from "@/components/mypage/flag-inbox-card";
import { MypageTopBar } from "@/components/mypage/mypage-top-bar";
import { ProfileHeader } from "@/components/mypage/profile-header";
import { SettingsSection } from "@/components/mypage/settings-section";
import {
  createCollection,
  deleteCollection,
  listMyCollections,
  updateCollection,
  type Collection,
  type CollectionVisibility,
} from "@/lib/collections/browser-api";
import { notifyBadgesUpdated } from "@/lib/mypage/badge-events";
import {
  fetchFlagNotifications,
  fetchMe,
  fetchMeBadges,
  markFlagsRead,
} from "@/lib/mypage/browser-api";
import { summarizeWeeklyFlags } from "@/lib/mypage/flag-inbox";

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
  const [shelfError, setShelfError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Profile + shelf are required; badges / flags degrade gracefully.
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
  }, []);

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
      setCollections((current) => [collection, ...current]);
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
    setEditingCollection(collection);
    setEditForm({
      name: collection.name,
      description: collection.description ?? "",
      visibility: collection.visibility,
      theme: collection.theme ?? "",
    });
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCollection) {
      return;
    }

    setBusy(true);
    setShelfError(null);
    try {
      const collection = await updateCollection(editingCollection.id, {
        name: editForm.name.trim(),
        description: editForm.description.trim() ? editForm.description : null,
        visibility: editForm.visibility,
        theme: editForm.theme.trim() ? editForm.theme : null,
      });
      setCollections((current) =>
        current.map((item) => (item.id === collection.id ? collection : item)),
      );
      setEditingCollection(null);
    } catch (err) {
      setShelfError(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(collection: Collection) {
    if (!window.confirm(`「${collection.name}」を削除しますか？`)) {
      return;
    }

    setBusy(true);
    setShelfError(null);
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
    } catch (err) {
      setShelfError(err instanceof Error ? err.message : "削除に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <MypageViewSkeleton />;
  }

  if (!me) {
    return (
      <div className="flex flex-1 items-center justify-center px-mogu-screen-x text-sm text-destructive">
        {error ?? "プロフィールを表示できませんでした"}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 pb-mogu-screen-y">
      <MypageTopBar />
      <ProfileHeader me={me} pendingFriendRequests={pendingFriendRequests} />
      <SettingsSection
        me={me}
        onProfileUpdated={(profile) =>
          setMe((current) => (current ? { ...current, ...profile } : current))
        }
      />
      <FlagInboxCard summary={flagSummary} />

      <section className="space-y-3 px-mogu-screen-x">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">棚を追加</h2>
          <button
            type="button"
            onClick={() => setShowCreateForm((current) => !current)}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-mogu-surface-elevated px-3 py-1.5 text-xs font-medium"
          >
            <Plus className="size-3.5" aria-hidden />
            新しい棚
          </button>
        </div>
        {showCreateForm ? (
          <form
            onSubmit={(event) => void handleCreate(event)}
            className="space-y-3 rounded-3xl border border-border bg-mogu-surface-elevated p-4"
          >
            <CollectionFormFields form={createForm} onChange={setCreateForm} />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="h-10 w-full rounded-2xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              作成する
            </button>
          </form>
        ) : null}
      </section>

      {editingCollection ? (
        <section className="space-y-3 px-mogu-screen-x">
          <h2 className="text-sm font-semibold text-foreground">
            「{editingCollection.name}」を編集
          </h2>
          <form
            onSubmit={(event) => void handleSaveEdit(event)}
            className="space-y-3 rounded-3xl border border-border bg-mogu-surface-elevated p-4"
          >
            <CollectionFormFields form={editForm} onChange={setEditForm} />
            {shelfError ? (
              <p className="text-sm text-destructive">{shelfError}</p>
            ) : null}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="h-10 flex-1 rounded-2xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                保存
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditingCollection(null)}
                className="h-10 flex-1 rounded-2xl border border-border bg-background text-sm font-medium"
              >
                キャンセル
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {shelfError && !editingCollection ? (
        <p className="px-mogu-screen-x text-sm text-destructive">{shelfError}</p>
      ) : null}

      <CollectionGrid
        collections={collections}
        onEdit={startEdit}
        onDelete={(collection) => void handleDelete(collection)}
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
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-foreground">名前</span>
        <input
          type="text"
          required
          maxLength={80}
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
          className="h-10 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          placeholder="週末に行きたい店"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-foreground">説明</span>
        <textarea
          maxLength={240}
          value={form.description}
          onChange={(event) =>
            onChange({ ...form, description: event.target.value })
          }
          className="min-h-20 w-full resize-none rounded-2xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          placeholder="どんな棚かメモ"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">公開範囲</span>
          <select
            value={form.visibility}
            onChange={(event) =>
              onChange({
                ...form,
                visibility: event.target.value as CollectionVisibility,
              })
            }
            className="h-10 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="friends">friends</option>
            <option value="secret">secret</option>
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">テーマ</span>
          <input
            type="text"
            maxLength={80}
            value={form.theme}
            onChange={(event) => onChange({ ...form, theme: event.target.value })}
            className="h-10 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder="デート"
          />
        </label>
      </div>
    </div>
  );
}
