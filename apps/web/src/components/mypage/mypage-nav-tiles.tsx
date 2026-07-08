"use client";

import Link from "next/link";
import { LibraryBig, Users } from "lucide-react";

import { AuthImage } from "@/components/mypage/auth-image";
import { Badge } from "@/components/ui/badge";
import { touchCardClass } from "@/lib/ui/touch-feedback";
import { cn } from "@/lib/utils";

type MypageNavTilesProps = {
  collectionCount: number;
  friendCount: number;
  showFriendBadge: boolean;
  /** First collection cover, used as the tile visual when present. */
  coverUrl: string | null;
  onCollectionsClick: () => void;
};

/**
 * Airbnb-style 2-column navigation tiles (#101):
 * コレクション (scrolls to collection grid) and 友達 (/mypage/friends).
 */
export function MypageNavTiles({
  collectionCount,
  friendCount,
  showFriendBadge,
  coverUrl,
  onCollectionsClick,
}: MypageNavTilesProps) {
  return (
    <section className="grid grid-cols-2 gap-3 px-mogu-screen-x">
      <button
        type="button"
        onClick={onCollectionsClick}
        className={cn(
          "group flex flex-col items-center gap-3 rounded-mogu-card bg-mogu-surface-elevated p-4 pb-5 text-center shadow-mogu-card transition-shadow hover:shadow-mogu-card-hover",
          touchCardClass,
        )}
      >
        <span className="relative mt-2 flex h-20 items-center justify-center">
          {coverUrl ? (
            <>
              <span
                className="absolute size-16 -rotate-6 rounded-2xl bg-muted shadow-sm"
                aria-hidden
              />
              <span className="relative size-16 rotate-3 overflow-hidden rounded-2xl shadow-sm">
                <AuthImage
                  objectUrl={coverUrl}
                  alt=""
                  className="size-full object-cover"
                />
              </span>
            </>
          ) : (
            <>
              <span
                className="absolute size-16 -rotate-6 rounded-2xl bg-muted shadow-sm"
                aria-hidden
              />
              <span className="relative flex size-16 rotate-3 items-center justify-center rounded-2xl bg-gradient-to-br from-muted to-background shadow-sm">
                <LibraryBig className="size-7 text-foreground" aria-hidden />
              </span>
            </>
          )}
        </span>
        <span>
          <span className="block text-sm font-semibold text-foreground">
            コレクション
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {collectionCount} 件
          </span>
        </span>
      </button>

      <Link
        href="/mypage/friends"
        className={cn(
          "group relative flex flex-col items-center gap-3 rounded-mogu-card bg-mogu-surface-elevated p-4 pb-5 text-center shadow-mogu-card transition-shadow hover:shadow-mogu-card-hover",
          touchCardClass,
        )}
      >
        {showFriendBadge ? (
          <Badge variant="alert" className="absolute right-3 top-3">
            NEW
          </Badge>
        ) : null}
        <span className="mt-2 flex h-20 items-center justify-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-muted to-background shadow-sm">
            <Users className="size-7 text-foreground" aria-hidden />
          </span>
        </span>
        <span>
          <span className="block text-sm font-semibold text-foreground">友達</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {friendCount} 人
          </span>
        </span>
      </Link>
    </section>
  );
}
