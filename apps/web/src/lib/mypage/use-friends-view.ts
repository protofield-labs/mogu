"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { notifyBadgesUpdated } from "@/lib/mypage/badge-events";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  fetchFriends,
  fetchIncomingFriendRequests,
  fetchOutgoingFriendRequests,
  rejectFriendRequest,
  removeFriend,
  searchUsers,
  sendFriendRequest,
} from "@/lib/mypage/browser-api";
import { useMe } from "@/lib/mypage/me-provider";
import { friendshipPairIdFromUserIds } from "@/lib/friends/pair-id";
import {
  findDuplicateDisplayNames,
  formatFriendRequestError,
  isAlreadyFriend,
  isIncomingPending,
  isOutgoingPending,
} from "@/lib/mypage/friend-request-ui";
import type { FriendListItem, FriendRequest, FriendUser } from "@/lib/mypage/types";

type RequestAction = "accept" | "reject" | "cancel";

export function useFriendsView() {
  const { me, loading: meLoading } = useMe();
  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [busyPairId, setBusyPairId] = useState<string | null>(null);
  const [busyRequestAction, setBusyRequestAction] = useState<RequestAction | null>(
    null,
  );
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [unfriendTarget, setUnfriendTarget] = useState<FriendListItem | null>(null);
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

  const friendCount = friends.length;
  const meId = me?.id ?? null;

  const loadFriendsData = useCallback(async () => {
    const [nextFriends, incoming, outgoing] = await Promise.all([
      fetchFriends(),
      fetchIncomingFriendRequests(),
      fetchOutgoingFriendRequests(),
    ]);
    setRequests(incoming);
    setOutgoingRequests(outgoing);
    setFriends(nextFriends);
  }, []);

  useEffect(() => {
    if (meLoading) {
      return;
    }

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
  }, [loadFriendsData, meLoading, reloadToken]);

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

  function handleSearchQueryChange(nextQuery: string) {
    setSearchQuery(nextQuery);
    if (nextQuery.trim().length === 0) {
      setSearchResults([]);
      setSearching(false);
      setSearchError(null);
    }
  }

  function handleRetryLoad() {
    setLoading(true);
    setLoadError(null);
    setReloadToken((current) => current + 1);
  }

  const trimmedQuery = searchQuery.trim();
  const showSearchEmpty =
    trimmedQuery.length > 0 &&
    !searching &&
    !searchError &&
    searchResults.length === 0;

  return {
    friends,
    requests,
    outgoingRequests,
    searchQuery,
    searchResults,
    searching,
    friendCount,
    loading: loading || meLoading,
    loadError,
    busyPairId,
    busyRequestAction,
    busyUserId,
    unfriendTarget,
    setUnfriendTarget,
    unfriendBusy,
    error,
    searchError,
    duplicateSearchNames,
    friendIds,
    outgoingUserIds,
    incomingUserIds,
    trimmedQuery,
    showSearchEmpty,
    handleAccept,
    handleReject,
    handleCancel,
    handleConfirmUnfriend,
    handleSendRequest,
    handleSearchQueryChange,
    handleRetryLoad,
  };
}
