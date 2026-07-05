"use client";

import { Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { CollectionGrid } from "@/components/mypage/collection-grid";
import { FlagInboxCard } from "@/components/mypage/flag-inbox-card";
import { MypageTopBar } from "@/components/mypage/mypage-top-bar";
import { ProfileHeader } from "@/components/mypage/profile-header";
import {
  createCollection,
  listMyCollections,
  type Collection,
  type CollectionVisibility,
} from "@/lib/collections/browser-api";
import {
  fetchFlagNotifications,
  fetchMe,
  fetchMeBadges,
  markFlagsRead,
} from "@/lib/mypage/browser-api";
import { summarizeWeeklyFlags } from "@/lib/mypage/flag-inbox";

type CreateForm = {
  name: string;
  visibility: CollectionVisibility;
};

const emptyCreateForm: CreateForm = {
  name: "",
  visibility: "friends",
};

export function MypageView() {
  const [me, setMe] = useState<Awaited<ReturnType<typeof fetchMe>> | null>(null);
  const [badges, setBadges] = useState<Awaited<ReturnType<typeof fetchMeBadges>> | null>(
    null,
  );
  const [collections, setCollections] = useState<Collection[]>([]);
  const [flagSummary, setFlagSummary] = useState(() =>
    summarizeWeeklyFlags([]),
  );
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreateForm);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [profile, nextBadges, nextCollections, notifications] =
          await Promise.all([
            fetchMe(),
            fetchMeBadges(),
            listMyCollections(),
            fetchFlagNotifications(),
          ]);

        if (cancelled) {
          return;
        }

        setMe(profile);
        setBadges(nextBadges);
        setCollections(nextCollections);
        setFlagSummary(summarizeWeeklyFlags(notifications));

        if (nextBadges.unreadFlags > 0) {
          try {
            await markFlagsRead();
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
      });
      setCollections((current) => [collection, ...current]);
      setCreateForm(emptyCreateForm);
      setShowCreateForm(false);
      if (me) {
        setMe({
          ...me,
          counts: {
            ...me.counts,
            collections: me.counts.collections + 1,
          },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "作成に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        マイページを読み込んでいます…
      </div>
    );
  }

  if (!me || !badges) {
    return (
      <div className="flex flex-1 items-center justify-center px-mogu-screen-x text-sm text-destructive">
        {error ?? "プロフィールを表示できませんでした"}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 pb-mogu-screen-y">
      <MypageTopBar />
      <ProfileHeader me={me} pendingFriendRequests={badges.pendingFriendRequests} />
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
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">名前</span>
              <input
                type="text"
                required
                maxLength={80}
                value={createForm.name}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder="週末に行きたい店"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">公開範囲</span>
              <select
                value={createForm.visibility}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    visibility: event.target.value as CollectionVisibility,
                  }))
                }
                className="h-10 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="friends">friends</option>
                <option value="secret">secret</option>
              </select>
            </label>
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

      <CollectionGrid collections={collections} />
    </div>
  );
}
