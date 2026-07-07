"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

import { UserAvatar } from "@/components/home/user-avatar";
import {
  friendHasUnreadFeed,
  sortFriendsForAvatarRow,
} from "@/lib/home/feed-read";
import type { FeedItem } from "@/lib/home/types";
import { friendProfilePath } from "@/lib/friends/paths";
import type { FriendUser } from "@/lib/mypage/types";

type AvatarRowProps = {
  friends: FriendUser[];
  feedItems: FeedItem[];
  lastReadAt: Date | null;
};

export function AvatarRow({ friends, feedItems, lastReadAt }: AvatarRowProps) {
  const sorted = sortFriendsForAvatarRow(friends, feedItems, lastReadAt);

  return (
    <section
      aria-label="友達"
      className="flex gap-3 overflow-x-auto px-mogu-screen-x pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {sorted.map((friend) => (
        <Link
          key={friend.id}
          href={friendProfilePath(friend.id)}
          className="flex w-14 shrink-0 flex-col items-center gap-1"
        >
          <UserAvatar
            displayName={friend.displayName}
            avatarColor={friend.avatarColor}
            showNewRing={friendHasUnreadFeed(friend.id, feedItems, lastReadAt)}
          />
          <span className="w-full truncate text-center text-xs text-muted-foreground">
            {friend.displayName}
          </span>
        </Link>
      ))}

      <Link
        href="/mypage/friends"
        className="flex w-14 shrink-0 flex-col items-center gap-1"
      >
        <span className="flex size-11 items-center justify-center rounded-full border border-dashed border-border bg-mogu-surface-elevated text-muted-foreground">
          <Plus className="size-4" aria-hidden />
        </span>
        <span className="text-xs text-muted-foreground">招待</span>
      </Link>
    </section>
  );
}
