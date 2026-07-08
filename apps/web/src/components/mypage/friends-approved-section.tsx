"use client";

import Link from "next/link";

import {
  friendAvatarProps,
} from "@/components/mypage/incoming-friend-request-list";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  FRIENDS_FROM_HOME,
  friendProfilePathWithContext,
} from "@/lib/friends/paths";
import type { FriendListItem } from "@/lib/mypage/types";
import { moguEnterDelayStyle, moguEnterMotionClass } from "@/lib/ui/motion";
import { cn } from "@/lib/utils";

type FriendsApprovedSectionProps = {
  friends: FriendListItem[];
  fromHome: boolean;
  onUnfriend: (friend: FriendListItem) => void;
};

export function FriendsApprovedSection({
  friends,
  fromHome,
  onUnfriend,
}: FriendsApprovedSectionProps) {
  return (
    <section className="space-y-2 px-mogu-screen-x">
      <h2 className="text-xs font-medium text-muted-foreground">承認済み</h2>
      {friends.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          まだ友達がいません。名前で検索して申請してみましょう。
        </p>
      ) : (
        <ul className="divide-y divide-border/70 overflow-hidden rounded-mogu-card bg-mogu-surface-elevated shadow-md">
          {friends.map((friend, index) => (
            <li
              key={friend.id}
              className={cn(
                "flex items-center gap-3 p-4",
                moguEnterMotionClass,
              )}
              style={moguEnterDelayStyle(index)}
            >
              <Link
                href={friendProfilePathWithContext(
                  friend.id,
                  fromHome ? { from: FRIENDS_FROM_HOME } : undefined,
                )}
                className="flex min-w-0 flex-1 items-center gap-3 transition-colors hover:opacity-80"
              >
                <Avatar {...friendAvatarProps(friend)} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {friend.displayName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    コレクション {friend.collectionCount}
                  </p>
                </div>
              </Link>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onUnfriend(friend)}
                className="shrink-0 rounded-full"
              >
                解除
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
