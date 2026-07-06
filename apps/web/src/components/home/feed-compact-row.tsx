"use client";

import { useState } from "react";

import { FeedSpotDetailSheet } from "@/components/home/feed-spot-detail-sheet";
import { SpotPlaceName } from "@/components/places/spot-place-name";
import { AuthImage } from "@/components/mypage/auth-image";
import { Button } from "@/components/ui/button";
import { formatViaLabel } from "@/lib/home/feed-labels";
import { recollectFeedSpot } from "@/lib/home/recollect-spot";
import type { FeedItem } from "@/lib/home/types";

type FeedCompactRowProps = {
  item: FeedItem;
};

export function FeedCompactRow({ item }: FeedCompactRowProps) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const photo = item.spot.photoUrls[0];

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
    <>
      <article className="flex items-center gap-3 rounded-2xl border border-border bg-mogu-surface-elevated p-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={() => setDetailOpen(true)}
        >
          {photo ? (
            <AuthImage
              objectUrl={photo}
              alt=""
              className="size-12 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground">
              店
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              <SpotPlaceName
                placeId={item.spot.placeId}
                fallback={item.spot.comment || item.collectionName}
              />
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {formatViaLabel(item.actor.displayName)}
              {item.spot.comment ? ` · ${item.spot.comment}` : ""}
            </p>
            {error ? (
              <p className="mt-1 text-xs text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </button>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0"
          disabled={busy || saved}
          onClick={(event) => {
            event.stopPropagation();
            void handleSave();
          }}
        >
          {saved ? "保存済み" : "保存"}
        </Button>
      </article>

      <FeedSpotDetailSheet
        item={item}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </>
  );
}
