"use client";

import { Bookmark, Heart, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatRatingChip } from "@/lib/home/feed-labels";
import type { Spot } from "@/lib/home/types";
import { touchRowClass } from "@/lib/ui/touch-feedback";
import { cn } from "@/lib/utils";

type FeedItemActionsProps = {
  rating: Spot["rating"];
  likedByMe: boolean;
  likeCount: number;
  likeBusy: boolean;
  onToggleLike: () => void;
  saved: boolean;
  busy: boolean;
  showSaveActions: boolean;
  saveHandlers: React.ComponentProps<"button">;
  onOpenDetail: () => void;
};

/** Instagram-style icon row: heart / link / bookmark + rating (#205, #212). */
export function FeedItemActions({
  rating,
  likedByMe,
  likeCount,
  likeBusy,
  onToggleLike,
  saved,
  busy,
  showSaveActions,
  saveHandlers,
  onOpenDetail,
}: FeedItemActionsProps) {
  return (
    <div className="flex items-center gap-1 px-mogu-screen-x pt-2.5">
      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn("size-9", touchRowClass)}
          disabled={likeBusy}
          aria-pressed={likedByMe}
          aria-label={likedByMe ? "いいね済み" : "いいね"}
          onClick={() => void onToggleLike()}
        >
          <Heart
            className={cn(
              "size-6",
              likedByMe && "fill-current text-destructive",
            )}
            aria-hidden
          />
        </Button>
        {likeCount > 0 ? (
          <span className="min-w-4 text-xs font-semibold tabular-nums text-foreground">
            {likeCount}
          </span>
        ) : null}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={cn("size-9", touchRowClass)}
        aria-label="スポット詳細を開く"
        onClick={onOpenDetail}
      >
        <Link2 className="size-6" aria-hidden />
      </Button>

      {showSaveActions ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn("size-9", touchRowClass)}
          disabled={busy}
          aria-pressed={saved}
          aria-label={saved ? "保存済み" : "保存"}
          {...saveHandlers}
        >
          <Bookmark
            className={cn("size-6", saved && "fill-current")}
            aria-hidden
          />
        </Button>
      ) : null}

      <span className="ml-auto text-xs font-semibold text-foreground">
        {formatRatingChip(rating)}
      </span>
    </div>
  );
}
