"use client";

import {
  friendAvatarProps,
} from "@/components/mypage/incoming-friend-request-list";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { FriendRequest } from "@/lib/mypage/types";

type FriendsOutgoingSectionProps = {
  outgoingRequests: FriendRequest[];
  busyPairId: string | null;
  busyRequestAction: "accept" | "reject" | "cancel" | null;
  onCancel: (pairId: string) => void;
};

export function FriendsOutgoingSection({
  outgoingRequests,
  busyPairId,
  busyRequestAction,
  onCancel,
}: FriendsOutgoingSectionProps) {
  if (outgoingRequests.length === 0) {
    return null;
  }

  return (
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
                onClick={() => onCancel(request.pairId)}
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
  );
}
