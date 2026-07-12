"use client";

import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import {
  formatStatsRow,
  shouldShowFriendRequestBadge,
} from "@/lib/mypage/stats-row";
import type { MeProfile } from "@/lib/mypage/types";

type ProfileHeroCardProps = {
  me: MeProfile;
  pendingFriendRequests: number;
};

/** Hero card: centered avatar/name stack + right vertical stats (#101). */
export function ProfileHeroCard({
  me,
  pendingFriendRequests,
}: ProfileHeroCardProps) {
  const stats = formatStatsRow(me.counts);
  const showFriendBadge = shouldShowFriendRequestBadge(pendingFriendRequests);

  return (
    <section className="px-mogu-screen-x">
      <div className="flex items-stretch gap-5 rounded-mogu-card bg-mogu-surface-elevated p-5 shadow-mogu-card">
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-2 text-center">
          <Avatar
            displayName={me.displayName}
            avatarColor={me.avatarColor}
            avatarUrl={me.avatarUrl}
            size="hero"
          />
          <div className="min-w-0">
            <h2 className="max-w-40 truncate text-xl font-semibold text-foreground">
              {me.displayName}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">{stats.spotsLabel}</p>
          </div>
        </div>

        <dl className="flex w-32 shrink-0 flex-col justify-center divide-y divide-border/70">
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
                className="relative inline-flex items-baseline text-base font-semibold text-foreground"
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
