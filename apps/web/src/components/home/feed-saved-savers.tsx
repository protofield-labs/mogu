"use client";

import { UserAvatar } from "@/components/home/user-avatar";
import { formatSavedSaversLabel } from "@/lib/home/feed-labels";
import type { FriendUser } from "@/lib/mypage/types";
import { cn } from "@/lib/utils";

type FeedSavedSaversProps = {
  savers: FriendUser[];
  savedCount: number;
};

/** Overlapping avatars + representative saver label (#205). */
export function FeedSavedSavers({ savers, savedCount }: FeedSavedSaversProps) {
  if (savedCount <= 0 || savers.length === 0) {
    return null;
  }

  const representative = savers[0]!;
  const label = formatSavedSaversLabel(representative.displayName, savedCount);

  return (
    <div className="flex items-center gap-2 px-mogu-screen-x pt-1.5">
      <div className="flex items-center" aria-hidden>
        {savers.map((saver, index) => (
          <UserAvatar
            key={saver.id}
            displayName={saver.displayName}
            avatarColor={saver.avatarColor}
            avatarUrl={saver.avatarUrl}
            className={cn(
              "size-7 text-[11px] ring-2 ring-background",
              index > 0 && "-ml-2",
            )}
          />
        ))}
      </div>
      <p className="text-xs text-foreground">{label}</p>
    </div>
  );
}
