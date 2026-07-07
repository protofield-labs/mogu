"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { FriendsViewSkeleton } from "@/components/loading/skeletons";
import { FriendsApprovedSection } from "@/components/mypage/friends-approved-section";
import { FriendsOutgoingSection } from "@/components/mypage/friends-outgoing-section";
import { FriendsSearchSection } from "@/components/mypage/friends-search-section";
import {
  IncomingFriendRequestList,
} from "@/components/mypage/incoming-friend-request-list";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { Spinner } from "@/components/ui/spinner";
import { friendsBackNavigation } from "@/lib/friends/paths";
import {
  isAlreadyFriend,
  isIncomingPending,
  isOutgoingPending,
} from "@/lib/mypage/friend-request-ui";
import { useFriendsView } from "@/lib/mypage/use-friends-view";
import type { FriendUser } from "@/lib/mypage/types";

type FriendsViewProps = {
  fromHome?: boolean;
};

export function FriendsView({ fromHome = false }: FriendsViewProps) {
  const view = useFriendsView();

  function renderSendButton(user: FriendUser) {
    if (isAlreadyFriend(user.id, view.friendIds)) {
      return (
        <span className="rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
          友達
        </span>
      );
    }
    const outgoingUserIds = view.outgoingUserIds;
    const incomingUserIds = view.incomingUserIds;
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
    const sending = view.busyUserId === user.id;
    return (
      <button
        type="button"
        disabled={sending}
        onClick={() => void view.handleSendRequest(user)}
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

  if (view.loading) {
    return <FriendsViewSkeleton />;
  }

  if (view.loadError) {
    return (
      <LoadErrorState message={view.loadError} onRetry={view.handleRetryLoad} />
    );
  }

  const backNavigation = friendsBackNavigation(fromHome);

  return (
    <div className="flex flex-1 flex-col gap-6 pb-mogu-screen-y">
      <header className="flex items-center gap-3 px-mogu-screen-x pt-3">
        <Link
          href={backNavigation.href}
          className="flex size-9 items-center justify-center rounded-full border border-border bg-mogu-surface-elevated"
          aria-label={backNavigation.ariaLabel}
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="flex-1 text-base font-semibold text-foreground">友達</h1>
        <span className="rounded-full border border-border bg-mogu-surface-elevated px-3 py-1 text-xs font-medium text-muted-foreground">
          {view.friendCount}人
        </span>
      </header>

      <FriendsSearchSection
        searchQuery={view.searchQuery}
        onSearchQueryChange={view.handleSearchQueryChange}
        searchResults={view.searchResults}
        searching={view.searching}
        searchError={view.searchError}
        showSearchEmpty={view.showSearchEmpty}
        trimmedQuery={view.trimmedQuery}
        duplicateSearchNames={view.duplicateSearchNames}
        renderSendButton={renderSendButton}
      />

      {view.error ? (
        <p className="px-mogu-screen-x text-sm text-destructive" role="alert">
          {view.error}
        </p>
      ) : null}

      <IncomingFriendRequestList
        className="space-y-2 px-mogu-screen-x"
        requests={view.requests}
        busyPairId={view.busyPairId}
        busyRequestAction={
          view.busyRequestAction === "accept" || view.busyRequestAction === "reject"
            ? view.busyRequestAction
            : null
        }
        onAccept={(pairId) => void view.handleAccept(pairId)}
        onReject={(pairId) => void view.handleReject(pairId)}
      />

      <FriendsOutgoingSection
        outgoingRequests={view.outgoingRequests}
        busyPairId={view.busyPairId}
        busyRequestAction={view.busyRequestAction}
        onCancel={(pairId) => void view.handleCancel(pairId)}
      />

      <FriendsApprovedSection
        friends={view.friends}
        fromHome={fromHome}
        onUnfriend={view.setUnfriendTarget}
      />

      <ConfirmDialog
        open={view.unfriendTarget !== null}
        title="友達を解除"
        description={
          view.unfriendTarget
            ? `${view.unfriendTarget.displayName}さんとの友達関係を解除しますか？相手のコレクションは見られなくなります。`
            : ""
        }
        confirmLabel="解除する"
        busy={view.unfriendBusy}
        onConfirm={() => void view.handleConfirmUnfriend()}
        onCancel={() => view.setUnfriendTarget(null)}
      />
    </div>
  );
}
