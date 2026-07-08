"use client";

import { Bookmark, Heart, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatRatingChip } from "@/lib/home/feed-labels";
import type { Spot } from "@/lib/home/types";
import { touchRowClass } from "@/lib/ui/touch-feedback";
import { cn } from "@/lib/utils";

type FeedItemActionsProps = {
  rating: Spot["rating"];
  saved: boolean;
  busy: boolean;
  showSaveActions: boolean;
  saveHandlers: React.ComponentProps<"button">;
  onOpenDetail: () => void;
};

/** Instagram-style icon row: heart (visual) / link / bookmark + rating (#205). */
export function FeedItemActions({
  rating,
  saved,
  busy,
  showSaveActions,
  saveHandlers,
  onOpenDetail,
}: FeedItemActionsProps) {
  return (
    <div className="flex items-center gap-1 px-mogu-screen-x pt-2.5">
      <Heart
        className="size-6 shrink-0 text-foreground/80"
        aria-hidden
      />

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
