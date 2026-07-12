"use client";

import { MoreHorizontal, UserMinus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  friendAvatarProps,
} from "@/components/mypage/incoming-friend-request-list";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetHeader,
} from "@/components/ui/sheet";
import {
  FRIENDS_FROM_HOME,
  friendProfilePathWithContext,
} from "@/lib/friends/paths";
import type { FriendListItem } from "@/lib/mypage/types";
import { moguEnterDelayStyle, moguEnterMotionClass } from "@/lib/ui/motion";
import { touchRowClass } from "@/lib/ui/touch-feedback";
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
  const [actionFriend, setActionFriend] = useState<FriendListItem | null>(null);

  function handleRequestUnfriend() {
    if (!actionFriend) {
      return;
    }
    const friend = actionFriend;
    setActionFriend(null);
    onUnfriend(friend);
  }

  return (
    <>
      <section className="space-y-2 px-mogu-screen-x">
        <h2 className="text-xs font-medium text-muted-foreground">友達</h2>
        {friends.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            まだ友達がいません。名前で検索して申請してみましょう。
          </p>
        ) : (
          <ul className="divide-y divide-border/70 overflow-hidden rounded-mogu-card bg-mogu-surface-elevated shadow-mogu-card">
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
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${friend.displayName}さんの操作`}
                  onClick={() => setActionFriend(friend)}
                  className="shrink-0"
                >
                  <MoreHorizontal className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Sheet
        open={actionFriend !== null}
        onClose={() => setActionFriend(null)}
        ariaLabel="友達の操作"
      >
        <SheetHeader>{actionFriend?.displayName ?? "友達"}</SheetHeader>
        <SheetBody className="py-2">
          <button
            type="button"
            onClick={handleRequestUnfriend}
            className={cn(
              "flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-sm font-medium text-destructive",
              touchRowClass,
            )}
          >
            <UserMinus className="size-4" aria-hidden />
            友達を解除
          </button>
        </SheetBody>
      </Sheet>
    </>
  );
}
