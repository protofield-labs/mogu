"use client";

import Link from "next/link";

import {
  formatStatsRow,
  shouldShowFriendRequestBadge,
} from "@/lib/mypage/stats-row";
import type { MeProfile } from "@/lib/mypage/types";

type ProfileHeroCardProps = {
  me: MeProfile;
  pendingFriendRequests: number;
};

/**
 * Airbnb-style hero card (#101): big avatar + name on the left,
 * stats as a divided vertical list on the right.
 */
export function ProfileHeroCard({
  me,
  pendingFriendRequests,
}: ProfileHeroCardProps) {
  const stats = formatStatsRow(me.counts);
  const showFriendBadge = shouldShowFriendRequestBadge(pendingFriendRequests);

  return (
    <section className="px-mogu-screen-x">
      <div className="flex items-stretch gap-5 rounded-3xl bg-mogu-surface-elevated p-5 shadow-sm">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-2">
          <span
            className="flex size-24 items-center justify-center rounded-full text-3xl font-semibold text-white shadow-sm"
            style={{ backgroundColor: me.avatarColor }}
            aria-hidden
          >
            {me.displayName.slice(0, 1) || "?"}
          </span>
          <div className="min-w-0 text-center">
            <h2 className="truncate text-lg font-semibold text-foreground">
              {me.displayName}
            </h2>
            <p className="text-xs text-muted-foreground">あなた</p>
          </div>
        </div>

        <dl className="flex w-32 shrink-0 flex-col justify-center divide-y divide-border">
          <div className="py-2.5">
            <dd className="text-base font-semibold text-foreground">
              {me.counts.collections}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                コレクション
              </span>
            </dd>
          </div>
          <div className="py-2.5">
            <dd className="text-base font-semibold text-foreground">
              {me.counts.spots}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                スポット
              </span>
            </dd>
          </div>
          <div className="py-2.5">
            <dd>
              <Link
                href="/mypage/friends"
                className="relative inline-flex items-baseline text-base font-semibold text-foreground underline-offset-4 hover:underline"
                aria-label={stats.friendsLabel}
              >
                {me.counts.friends}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  友達
                </span>
                {showFriendBadge ? (
                  <span
                    className="absolute -right-2.5 -top-1 size-2 rounded-full bg-mogu-badge"
                    aria-label="友達申請あり"
                  />
                ) : null}
              </Link>
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
