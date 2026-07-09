"use client";

import { Lock } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { FriendRequest, FriendUser } from "@/lib/mypage/types";

export function friendAvatarProps(
  user: Pick<FriendUser, "displayName" | "avatarColor" | "avatarUrl">,
  options?: { emphasizeColor?: boolean; showInitial?: boolean },
) {
  return {
    displayName: user.displayName,
    avatarColor: user.avatarColor,
    avatarUrl: user.avatarUrl,
    size: options?.emphasizeColor ? ("xl" as const) : ("sm" as const),
    showInitial: options?.showInitial ?? true,
  };
}

type RequestAction = "accept" | "reject";

type IncomingFriendRequestListProps = {
  requests: FriendRequest[];
  busyPairId: string | null;
  busyRequestAction: RequestAction | null;
  onAccept: (pairId: string) => void;
  onReject: (pairId: string) => void;
  className?: string;
};

export function IncomingFriendRequestList({
  requests,
  busyPairId,
  busyRequestAction,
  onAccept,
  onReject,
  className,
}: IncomingFriendRequestListProps) {
  if (requests.length === 0) {
    return null;
  }

  return (
    <section className={className}>
      <h2 className="text-xs font-medium text-muted-foreground">友達申請</h2>
      <ul className="mt-2 space-y-3">
        {requests.map((request) => {
          const isBusy = busyPairId === request.pairId;
          return (
            <li
              key={request.pairId}
              className="rounded-2xl bg-mogu-surface-elevated p-4 shadow-mogu-card"
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
                  onClick={() => onReject(request.pairId)}
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
                  onClick={() => onAccept(request.pairId)}
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
  );
}
