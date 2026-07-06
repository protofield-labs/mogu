"use client";

import { ChevronLeft, Lock, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { FriendsViewSkeleton } from "@/components/loading/skeletons";
import { notifyBadgesUpdated } from "@/lib/mypage/badge-events";
import {
  acceptFriendRequest,
  fetchFriendCollectionCount,
  fetchFriends,
  fetchIncomingFriendRequests,
  fetchMe,
  searchUsers,
  sendFriendRequest,
} from "@/lib/mypage/browser-api";
import type { FriendRequest, FriendUser } from "@/lib/mypage/types";
import { cn } from "@/lib/utils";

type FriendWithCollections = FriendUser & {
  collectionCount: number;
};

function UserAvatar({
  user,
  className,
}: {
  user: Pick<FriendUser, "displayName" | "avatarColor">;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
        className,
      )}
      style={{ backgroundColor: user.avatarColor }}
      aria-hidden
    >
      {user.displayName.slice(0, 1)}
    </span>
  );
}

export function FriendsView() {
  const [friends, setFriends] = useState<FriendWithCollections[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendUser[]>([]);
  const [friendCount, setFriendCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyPairId, setBusyPairId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadFriendsData = useCallback(async () => {
    const [me, nextFriends, incoming] = await Promise.all([
      fetchMe(),
      fetchFriends(),
      fetchIncomingFriendRequests(),
    ]);
    setFriendCount(me.counts.friends);
    setRequests(incoming);

    const withCounts = await Promise.all(
      nextFriends.map(async (friend) => ({
        ...friend,
        collectionCount: await fetchFriendCollectionCount(friend.id),
      })),
    );
    setFriends(withCounts);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await loadFriendsData();
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
  }, [loadFriendsData]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length === 0) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void searchUsers(query)
        .then((results) => {
          if (!cancelled) {
            setSearchResults(results);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "検索に失敗しました");
          }
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  async function handleAccept(pairId: string) {
    setBusyPairId(pairId);
    setError(null);
    try {
      await acceptFriendRequest(pairId);
      notifyBadgesUpdated();
      await loadFriendsData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "承認に失敗しました");
    } finally {
      setBusyPairId(null);
    }
  }

  async function handleSendRequest(userId: string) {
    setError(null);
    try {
      await sendFriendRequest(userId);
      setSearchQuery("");
      setSearchResults([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "申請に失敗しました");
    }
  }

  if (loading) {
    return <FriendsViewSkeleton />;
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
        <h1 className="flex-1 text-base font-semibold text-foreground">友達</h1>
        <span className="rounded-full border border-border bg-mogu-surface-elevated px-3 py-1 text-xs font-medium text-muted-foreground">
          {friendCount}人
        </span>
      </header>

      <div className="px-mogu-screen-x">
        <label className="relative block">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => {
              const nextQuery = event.target.value;
              setSearchQuery(nextQuery);
              if (nextQuery.trim().length === 0) {
                setSearchResults([]);
              }
            }}
            placeholder="名前で友達を探す"
            className="h-11 w-full rounded-2xl border border-border bg-mogu-surface-elevated pl-10 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
      </div>

      {error ? (
        <p className="px-mogu-screen-x text-sm text-destructive">{error}</p>
      ) : null}

      {searchResults.length > 0 ? (
        <section className="space-y-2 px-mogu-screen-x">
          <h2 className="text-xs font-medium text-muted-foreground">検索結果</h2>
          <ul className="space-y-2">
            {searchResults.map((user) => (
              <li
                key={user.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-mogu-surface-elevated p-3"
              >
                <UserAvatar user={user} />
                <span className="flex-1 text-sm font-medium text-foreground">
                  {user.displayName}
                </span>
                <button
                  type="button"
                  onClick={() => void handleSendRequest(user.id)}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium"
                >
                  申請
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2 px-mogu-screen-x">
        <h2 className="text-xs font-medium text-muted-foreground">承認済み</h2>
        {friends.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            まだ友達がいません。名前で検索して申請してみましょう。
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-mogu-surface-elevated">
            {friends.map((friend) => (
              <li key={friend.id} className="flex items-center gap-3 p-4">
                <UserAvatar user={friend} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {friend.displayName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    コレクション {friend.collectionCount}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {requests.length > 0 ? (
        <section className="space-y-2 px-mogu-screen-x">
          <h2 className="text-xs font-medium text-muted-foreground">申請(受信)</h2>
          <ul className="space-y-3">
            {requests.map((request) => (
              <li
                key={request.pairId}
                className="rounded-2xl border border-border bg-mogu-surface-elevated p-4"
              >
                <div className="flex items-center gap-3">
                  <UserAvatar user={request.from} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {request.from.displayName}
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Lock className="size-3.5" aria-hidden />
                      承認すると見られます
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busyPairId === request.pairId}
                  onClick={() => void handleAccept(request.pairId)}
                  className="mt-4 h-10 w-full rounded-2xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  承認
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
