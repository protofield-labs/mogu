"use client";

import Link from "next/link";
import { Plus, X } from "lucide-react";

import { UserAvatar } from "@/components/home/user-avatar";
import {
  friendHasUnreadFeed,
  sortFriendsForAvatarRow,
} from "@/lib/home/feed-read";
import type { FeedItem } from "@/lib/home/types";
import { FRIENDS_FROM_HOME, friendsPagePath } from "@/lib/friends/paths";
import type { FriendUser } from "@/lib/mypage/types";
import { touchRowClass } from "@/lib/ui/touch-feedback";
import { cn } from "@/lib/utils";

type AvatarRowProps = {
  friends: FriendUser[];
  feedItems: FeedItem[];
  lastReadAt: Date | null;
  selectedFriendId: string | null;
  onSelectFriend: (friendId: string) => void;
};

export function AvatarRow({
  friends,
  feedItems,
  lastReadAt,
  selectedFriendId,
  onSelectFriend,
}: AvatarRowProps) {
  const sorted = sortFriendsForAvatarRow(friends, feedItems, lastReadAt);

  return (
    <section
      aria-label="友達"
      className="flex shrink-0 gap-3 overflow-x-auto px-mogu-screen-x pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <Link
        href={friendsPagePath({ from: FRIENDS_FROM_HOME })}
        className={cn(
          "flex w-14 shrink-0 flex-col items-center gap-1",
          touchRowClass,
        )}
      >
        <span className="flex size-11 items-center justify-center rounded-full border border-dashed border-border bg-mogu-surface-elevated text-muted-foreground">
          <Plus className="size-4" aria-hidden />
        </span>
        <span className="text-xs text-muted-foreground">招待</span>
      </Link>

      {sorted.map((friend) => {
        const selected = selectedFriendId === friend.id;
        return (
          <button
            key={friend.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelectFriend(friend.id)}
            className={cn(
              "flex w-14 shrink-0 flex-col items-center gap-1",
              touchRowClass,
            )}
          >
            <UserAvatar
              displayName={friend.displayName}
              avatarColor={friend.avatarColor}
              showNewRing={
                !selected &&
                friendHasUnreadFeed(friend.id, feedItems, lastReadAt)
              }
              className={cn(
                selected &&
                  "ring-2 ring-primary ring-offset-2 ring-offset-background",
              )}
            />
            <span
              className={cn(
                "w-full truncate text-center text-xs",
                selected ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {friend.displayName}
            </span>
          </button>
        );
      })}
    </section>
  );
}

type FeedFilterChipProps = {
  displayName: string;
  onClear: () => void;
};

export function FeedFilterChip({ displayName, onClear }: FeedFilterChipProps) {
  return (
    <div className="flex px-mogu-screen-x shrink-0">
      <button
        type="button"
        onClick={onClear}
        className={cn(
          "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-mogu-surface-elevated px-3 py-2 text-sm font-medium text-foreground",
          touchRowClass,
        )}
      >
        <span>{displayName}さんの新着</span>
        <X className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="sr-only">絞り込みを解除</span>
      </button>
    </div>
  );
}
