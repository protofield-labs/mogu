"use client";

import { Avatar } from "@/components/ui/avatar";
import { SurfaceCard } from "@/components/ui/card";
import type { FriendProfile } from "@/lib/friends/browser-api";

type FriendProfileHeroCardProps = {
  profile: FriendProfile;
};

/** Read-only profile hero for an accepted friend (#116). */
export function FriendProfileHeroCard({ profile }: FriendProfileHeroCardProps) {
  return (
    <section className="px-mogu-screen-x">
      <SurfaceCard className="flex items-stretch gap-5 overflow-hidden p-5">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-2">
          <Avatar
            displayName={profile.displayName}
            avatarColor={profile.avatarColor}
            avatarUrl={profile.avatarUrl}
            size="hero"
          />
          <div className="min-w-0 text-center">
            <h2 className="truncate text-lg font-semibold text-foreground">
              {profile.displayName}
            </h2>
          </div>
        </div>

        <dl className="flex w-32 shrink-0 flex-col justify-center divide-y divide-border">
          <div className="py-2.5">
            <dd className="text-base font-semibold text-foreground">
              {profile.counts.collections}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                コレクション
              </span>
            </dd>
          </div>
          <div className="py-2.5">
            <dd className="text-base font-semibold text-foreground">
              {profile.counts.spots}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                スポット
              </span>
            </dd>
          </div>
        </dl>
      </SurfaceCard>
    </section>
  );
}
