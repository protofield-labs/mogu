"use client";

import { ChevronLeft, Lock, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { FriendsViewSkeleton } from "@/components/loading/skeletons";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { Spinner } from "@/components/ui/spinner";
import { notifyBadgesUpdated } from "@/lib/mypage/badge-events";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  fetchFriendCollectionCount,
  fetchFriends,
  fetchIncomingFriendRequests,
  fetchMe,
  fetchOutgoingFriendRequests,
  rejectFriendRequest,
  removeFriend,
  searchUsers,
  sendFriendRequest,
} from "@/lib/mypage/browser-api";
import { friendshipPairIdFromUserIds } from "@/lib/friends/pair-id";
import {
  findDuplicateDisplayNames,
  formatAvatarColorLabel,
  formatFriendRequestError,
  isAlreadyFriend,
  isIncomingPending,
  isOutgoingPending,
} from "@/lib/mypage/friend-request-ui";
import type { FriendRequest, FriendUser } from "@/lib/mypage/types";
import { friendProfilePath } from "@/lib/friends/paths";
import { cn } from "@/lib/utils";

type FriendWithCollections = FriendUser & {
  collectionCount: number;
};

function friendAvatarProps(
  user: Pick<FriendUser, "displayName" | "avatarColor">,
  options?: { emphasizeColor?: boolean; showInitial?: boolean },
) {
  return {
    displayName: user.displayName,
    avatarColor: user.avatarColor,
    size: options?.emphasizeColor ? ("xl" as const) : ("sm" as const),
    showInitial: options?.showInitial ?? true,
  };
}

type RequestAction = "accept" | "reject" | "cancel";

export function FriendsView() {
  const [friends, setFriends] = useState<FriendWithCollections[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [friendCount, setFriendCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [busyPairId, setBusyPairId] = useState<string | null>(null);
  const [busyRequestAction, setBusyRequestAction] = useState<RequestAction | null>(
    null,
  );
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [unfriendTarget, setUnfriendTarget] = useState<FriendWithCollections | null>(
    null,
  );
  const [unfriendBusy, setUnfriendBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const friendIds = useMemo(
    () => new Set(friends.map((friend) => friend.id)),
    [friends],
  );
  const outgoingUserIds = useMemo(
    () => new Set(outgoingRequests.map((request) => request.to.id)),
    [outgoingRequests],
  );
  const incomingUserIds = useMemo(
    () => new Set(requests.map((request) => request.from.id)),
    [requests],
  );
  const duplicateSearchNames = useMemo(
    () => findDuplicateDisplayNames(searchResults),
    [searchResults],
  );

  const loadFriendsData = useCallback(async () => {
    const [me, nextFriends, incoming, outgoing] = await Promise.all([
      fetchMe(),
      fetchFriends(),
      fetchIncomingFriendRequests(),
      fetchOutgoingFriendRequests(),
    ]);
    setFriendCount(me.counts.friends);
    setMeId(me.id);
    setRequests(incoming);
    setOutgoingRequests(outgoing);

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
  }, [loadFriendsData, reloadToken]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length === 0) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchUsers(query)
        .then((results) => {
          if (!cancelled) {
            setSearchResults(results);
            setSearchError(null);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setSearchError(
              err instanceof Error ? err.message : "検索に失敗しました",
            );
            setSearchResults([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setSearching(false);
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
    setBusyRequestAction("accept");
    setError(null);
    try {
      await acceptFriendRequest(pairId);
      notifyBadgesUpdated();
      await loadFriendsData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "承認に失敗しました");
    } finally {
      setBusyPairId(null);
      setBusyRequestAction(null);
    }
  }

  async function handleReject(pairId: string) {
    setBusyPairId(pairId);
    setBusyRequestAction("reject");
    setError(null);
    try {
      await rejectFriendRequest(pairId);
      notifyBadgesUpdated();
      await loadFriendsData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "拒否に失敗しました");
    } finally {
      setBusyPairId(null);
      setBusyRequestAction(null);
    }
  }

  async function handleCancel(pairId: string) {
    setBusyPairId(pairId);
    setBusyRequestAction("cancel");
    setError(null);
    try {
      await cancelFriendRequest(pairId);
      notifyBadgesUpdated();
      await loadFriendsData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "取り消しに失敗しました");
    } finally {
      setBusyPairId(null);
      setBusyRequestAction(null);
    }
  }

  async function handleConfirmUnfriend() {
    if (!unfriendTarget || !meId) {
      return;
    }
    setUnfriendBusy(true);
    setError(null);
    try {
      const pairId = friendshipPairIdFromUserIds(meId, unfriendTarget.id);
      await removeFriend(pairId);
      notifyBadgesUpdated();
      setUnfriendTarget(null);
      await loadFriendsData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "友達解除に失敗しました");
    } finally {
      setUnfriendBusy(false);
    }
  }

  async function refreshFriendsData(failureMessage: string) {
    try {
      await loadFriendsData();
    } catch {
      setError(failureMessage);
    }
  }

  async function handleSendRequest(user: FriendUser) {
    if (
      busyUserId === user.id ||
      isAlreadyFriend(user.id, friendIds) ||
      isOutgoingPending(user.id, outgoingUserIds) ||
      isIncomingPending(user.id, incomingUserIds)
    ) {
      return;
    }

    setBusyUserId(user.id);
    setError(null);
    try {
      try {
        await sendFriendRequest(user.id);
      } catch (err) {
        const message = formatFriendRequestError(err, "申請に失敗しました");
        setError(message);
        if (message === "すでに申請済みです") {
          await refreshFriendsData("一覧の更新に失敗しました");
        }
        return;
      }

      await refreshFriendsData("申請は送信しましたが、一覧の更新に失敗しました");
    } finally {
      setBusyUserId(null);
    }
  }

  function renderSendButton(user: FriendUser) {
    if (isAlreadyFriend(user.id, friendIds)) {
      return (
        <span className="rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
          友達
        </span>
      );
    }
    if (isOutgoingPending(user.id, outgoingUserIds)) {
      return (
        <span className="rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
          申請済み
        </span>
      );
    }
    if (isIncomingPending(user.id, incomingUserIds)) {
      return (
        <span className="rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
          申請あり
        </span>
      );
    }
    const sending = busyUserId === user.id;
    return (
      <button
        type="button"
        disabled={sending}
        onClick={() => void handleSendRequest(user)}
        className="inline-flex min-w-[4.5rem] items-center justify-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium disabled:opacity-50"
      >
        {sending ? (
          <>
            <Spinner size="sm" />
            送信中
          </>
        ) : (
          "申請"
        )}
      </button>
    );
  }

  function handleRetryLoad() {
    setLoading(true);
    setLoadError(null);
    setReloadToken((current) => current + 1);
  }

  if (loading) {
    return <FriendsViewSkeleton />;
  }

  if (loadError) {
    return (
      <LoadErrorState message={loadError} onRetry={handleRetryLoad} />
    );
  }

  const trimmedQuery = searchQuery.trim();
  const showSearchEmpty =
    trimmedQuery.length > 0 &&
    !searching &&
    !searchError &&
    searchResults.length === 0;

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
                setSearching(false);
                setSearchError(null);
              }
            }}
            placeholder="名前で友達を探す"
            className="h-11 w-full rounded-2xl border border-border bg-mogu-surface-elevated pl-10 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
      </div>

      {error ? (
        <p className="px-mogu-screen-x text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {searchError ? (
        <p className="px-mogu-screen-x text-sm text-destructive" role="alert">
          {searchError}
        </p>
      ) : null}

      {searching ? (
        <p className="px-mogu-screen-x text-sm text-muted-foreground">検索中…</p>
      ) : null}

      {showSearchEmpty ? (
        <p className="px-mogu-screen-x text-sm text-muted-foreground">
          「{trimmedQuery}」に一致するユーザーが見つかりませんでした
        </p>
      ) : null}

      {searchResults.length > 0 ? (
        <section className="space-y-2 px-mogu-screen-x">
          <h2 className="text-xs font-medium text-muted-foreground">検索結果</h2>
          <ul className="space-y-2">
            {searchResults.map((user) => {
              const showColorHint = duplicateSearchNames.has(user.displayName);
              return (
                <li
                  key={user.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-mogu-surface-elevated p-3"
                >
                  <Avatar
                    {...friendAvatarProps(user, {
                      emphasizeColor: showColorHint,
                      showInitial: !showColorHint,
                    })}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {user.displayName}
                    </p>
                    {showColorHint ? (
                      <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span
                          className="inline-block size-3 rounded-full border border-border"
                          style={{ backgroundColor: user.avatarColor }}
                          aria-hidden
                        />
                        {formatAvatarColorLabel(user.avatarColor)}
                      </p>
                    ) : null}
                  </div>
                  {renderSendButton(user)}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {requests.length > 0 ? (
        <section className="space-y-2 px-mogu-screen-x">
          <h2 className="text-xs font-medium text-muted-foreground">申請(受信)</h2>
          <ul className="space-y-3">
            {requests.map((request) => {
              const isBusy = busyPairId === request.pairId;
              return (
              <li
                key={request.pairId}
                className="rounded-2xl border border-border bg-mogu-surface-elevated p-4"
              >
                <div className="flex items-center gap-3">
                  <Avatar {...friendAvatarProps(request.from)} />
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
                <div className="mt-4 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isBusy}
                    onClick={() => void handleReject(request.pairId)}
                    className="h-10 flex-1 rounded-2xl"
                  >
                    {isBusy && busyRequestAction === "reject" ? (
                      <>
                        <Spinner />
                        処理中…
                      </>
                    ) : (
                      "拒否"
                    )}
                  </Button>
                  <Button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleAccept(request.pairId)}
                    className="h-10 flex-1 rounded-2xl"
                  >
                    {isBusy && busyRequestAction === "accept" ? (
                      <>
                        <Spinner />
                        処理中…
                      </>
                    ) : (
                      "承認"
                    )}
                  </Button>
                </div>
              </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {outgoingRequests.length > 0 ? (
        <section className="space-y-2 px-mogu-screen-x">
          <h2 className="text-xs font-medium text-muted-foreground">申請(送信)</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-mogu-surface-elevated">
            {outgoingRequests.map((request) => {
              const isBusy = busyPairId === request.pairId;
              return (
              <li key={request.pairId} className="flex items-center gap-3 p-4">
                <Avatar {...friendAvatarProps(request.to)} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {request.to.displayName}
                  </p>
                  <p className="text-xs text-muted-foreground">承認待ち</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => void handleCancel(request.pairId)}
                  className="shrink-0 rounded-full"
                >
                  {isBusy && busyRequestAction === "cancel" ? (
                    <>
                      <Spinner />
                      処理中…
                    </>
                  ) : (
                    "取り消す"
                  )}
                </Button>
              </li>
              );
            })}
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
                <Link
                  href={friendProfilePath(friend.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 transition-colors hover:opacity-80"
                >
                  <Avatar {...friendAvatarProps(friend)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {friend.displayName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      コレクション {friend.collectionCount}
                    </p>
                  </div>
                </Link>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setUnfriendTarget(friend)}
                  className="shrink-0 rounded-full"
                >
                  解除
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={unfriendTarget !== null}
        title="友達を解除"
        description={
          unfriendTarget
            ? `${unfriendTarget.displayName}さんとの友達関係を解除しますか？相手のコレクションは見られなくなります。`
            : ""
        }
        confirmLabel="解除する"
        busy={unfriendBusy}
        onConfirm={() => void handleConfirmUnfriend()}
        onCancel={() => setUnfriendTarget(null)}
      />
    </div>
  );
}
