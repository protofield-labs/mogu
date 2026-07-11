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
  sendFriendRequest,
} from "@/lib/mypage/browser-api";
import { useMe } from "@/lib/mypage/me-provider";
import { friendshipPairIdFromUserIds } from "@/lib/friends/pair-id";
import {
  formatFriendRequestError,
  isAlreadyFriend,
  isIncomingPending,
  isOutgoingPending,
} from "@/lib/mypage/friend-request-ui";
import { useFriendSearch } from "@/lib/mypage/use-friend-search";
import type { FriendListItem, FriendRequest, FriendUser } from "@/lib/mypage/types";
import { formatLoadError } from "@/lib/ui/load-error";
import { useAsyncLoadEffect } from "@/lib/ui/use-async-load";

type RequestAction = "accept" | "reject" | "cancel";

const REQUEST_ERROR_MESSAGES: Record<RequestAction, string> = {
  accept: "承認に失敗しました",
  reject: "拒否に失敗しました",
  cancel: "取り消しに失敗しました",
};

const REQUEST_ACTIONS: Record<
  RequestAction,
  (pairId: string) => Promise<void>
> = {
  accept: acceptFriendRequest,
  reject: rejectFriendRequest,
  cancel: cancelFriendRequest,
};

export function useFriendsView() {
  const { me, loading: meLoading } = useMe();
  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [reloadToken, setReloadToken] = useState(0);
  const [busyPairId, setBusyPairId] = useState<string | null>(null);
  const [busyRequestAction, setBusyRequestAction] = useState<RequestAction | null>(
    null,
  );
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [unfriendTarget, setUnfriendTarget] = useState<FriendListItem | null>(null);
  const [unfriendBusy, setUnfriendBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    searchQuery,
    searchResults,
    searching,
    searchError,
    duplicateSearchNames,
    trimmedQuery,
    showSearchEmpty,
    handleSearchQueryChange,
  } = useFriendSearch();

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

  const {
    loading,
    error: loadError,
    setLoading,
    setError: setLoadError,
  } = useAsyncLoadEffect(
    async () => {
      await loadFriendsData();
    },
    [loadFriendsData, reloadToken],
    { enabled: !meLoading },
  );

  const runFriendRequestAction = useCallback(
    async (action: RequestAction, pairId: string) => {
      setBusyPairId(pairId);
      setBusyRequestAction(action);
      setError(null);
      try {
        await REQUEST_ACTIONS[action](pairId);
        notifyBadgesUpdated();
        await loadFriendsData();
      } catch (err) {
        setError(formatLoadError(err, REQUEST_ERROR_MESSAGES[action]));
      } finally {
        setBusyPairId(null);
        setBusyRequestAction(null);
      }
    },
    [loadFriendsData],
  );

  const handleAccept = useCallback(
    (pairId: string) => runFriendRequestAction("accept", pairId),
    [runFriendRequestAction],
  );
  const handleReject = useCallback(
    (pairId: string) => runFriendRequestAction("reject", pairId),
    [runFriendRequestAction],
  );
  const handleCancel = useCallback(
    (pairId: string) => runFriendRequestAction("cancel", pairId),
    [runFriendRequestAction],
  );

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
      setError(formatLoadError(err, "友達解除に失敗しました"));
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

  function handleRetryLoad() {
    setLoading(true);
    setLoadError(null);
    setReloadToken((current) => current + 1);
  }

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
