"use client";

import { useState } from "react";

import { UserAvatar } from "@/components/home/user-avatar";
import { AuthImage } from "@/components/mypage/auth-image";
import { Button } from "@/components/ui/button";
import {
  formatRatingChip,
  formatSavedCountBadge,
} from "@/lib/home/feed-labels";
import { recollectFeedSpot } from "@/lib/home/recollect-spot";
import type { FeedItem } from "@/lib/home/types";

type FeedHeroCardProps = {
  item: FeedItem;
};

export function FeedHeroCard({ item }: FeedHeroCardProps) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedBadge = formatSavedCountBadge(item.spot.savedCount);

  async function handleSave() {
    setBusy(true);
    setError(null);
    const result = await recollectFeedSpot(item.spot.id);
    setBusy(false);
    if (result.ok) {
      setSaved(true);
    } else {
      setError(result.error);
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-mogu-surface-elevated">
      <div className="relative">
        {item.spot.photoUrls.length > 0 ? (
          <div className="flex snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {item.spot.photoUrls.map((url) => (
              <AuthImage
                key={url}
                objectUrl={url}
                alt=""
                className="aspect-[4/3] w-full shrink-0 snap-center object-cover"
              />
            ))}
          </div>
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center bg-muted text-sm text-muted-foreground">
            写真なし
          </div>
        )}
        {savedBadge ? (
          <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground backdrop-blur-sm">
            {savedBadge}
          </span>
        ) : null}
      </div>

      <div className="space-y-3 p-mogu-screen-x py-3">
        <div className="flex items-start gap-2">
          <UserAvatar
            displayName={item.actor.displayName}
            avatarColor={item.actor.avatarColor}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              {item.actor.displayName}
            </p>
            <p className="mt-1 text-sm text-foreground">{item.spot.comment || item.collectionName}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground">
            {formatRatingChip(item.spot.rating)}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy || saved}
            onClick={() => void handleSave()}
          >
            {saved ? "保存済み" : "保存"}
          </Button>
        </div>

        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </article>
  );
}
