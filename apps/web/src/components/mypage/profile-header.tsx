"use client";

import Link from "next/link";

import {
  formatStatsRow,
  shouldShowFriendRequestBadge,
} from "@/lib/mypage/stats-row";
import type { MeProfile } from "@/lib/mypage/types";
import { cn } from "@/lib/utils";

type ProfileHeaderProps = {
  me: MeProfile;
  pendingFriendRequests: number;
};

export function ProfileHeader({ me, pendingFriendRequests }: ProfileHeaderProps) {
  const stats = formatStatsRow(me.counts);
  const showFriendBadge = shouldShowFriendRequestBadge(pendingFriendRequests);

  return (
    <section className="px-mogu-screen-x">
      <div className="flex items-center gap-3">
        <div
          className="flex size-14 items-center justify-center rounded-full text-lg font-semibold text-white"
          style={{ backgroundColor: me.avatarColor }}
          aria-hidden
        >
          {me.displayName.slice(0, 1)}
        </div>
        <div>
          <h1 className="text-base font-semibold text-foreground">{me.displayName}</h1>
          <p className="text-sm text-muted-foreground">あなた</p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-mogu-surface-elevated px-2 py-3">
          <dt className="text-xs text-muted-foreground">棚</dt>
          <dd className="mt-1 text-sm font-semibold text-foreground">
            {stats.collectionsLabel}
          </dd>
        </div>
        <div className="rounded-2xl bg-mogu-surface-elevated px-2 py-3">
          <dt className="text-xs text-muted-foreground">スポット</dt>
          <dd className="mt-1 text-sm font-semibold text-foreground">
            {stats.spotsLabel}
          </dd>
        </div>
        <div className="rounded-2xl bg-mogu-surface-elevated px-2 py-3">
          <dt className="text-xs text-muted-foreground">友達</dt>
          <dd className="mt-1">
            <Link
              href="/mypage/friends"
              className={cn(
                "relative inline-flex text-sm font-semibold text-foreground underline-offset-4 hover:underline",
              )}
            >
              {stats.friendsLabel}
              {showFriendBadge ? (
                <span
                  className="absolute -right-2 -top-1 size-2 rounded-full bg-mogu-badge"
                  aria-label="友達申請あり"
                />
              ) : null}
            </Link>
          </dd>
        </div>
      </dl>
    </section>
  );
}
