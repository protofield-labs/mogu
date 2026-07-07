"use client";

import Link from "next/link";
import { useState } from "react";

import { FeedSpotDetailSheet } from "@/components/home/feed-spot-detail-sheet";
import { SpotPlaceName } from "@/components/places/spot-place-name";
import { AuthImage } from "@/components/mypage/auth-image";
import { Button } from "@/components/ui/button";
import { formatViaLabel } from "@/lib/home/feed-labels";
import { recollectFeedSpot } from "@/lib/home/recollect-spot";
import type { FeedItem } from "@/lib/home/types";
import { friendProfilePath, actorProfilePath } from "@/lib/friends/paths";
import { showRecollectSuccessToast } from "@/lib/ui/recollect-toast";
import { usePlace } from "@/lib/places/use-place";

type FeedCompactRowProps = {
  item: FeedItem;
  viewerId?: string | null;
};

export function FeedCompactRow({ item, viewerId }: FeedCompactRowProps) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { place, placeName } = usePlace(item.spot.placeId);
  const photo = item.spot.photoUrls[0];
  const titleFallback = item.spot.comment || item.collectionName;

  async function handleSave() {
    setBusy(true);
    setError(null);
    const result = await recollectFeedSpot(item.spot.id);
    setBusy(false);
    if (result.ok) {
      setSaved(true);
      showRecollectSuccessToast(result.collectionName);
    } else {
      setError(result.error);
    }
  }

  function openDetail() {
    setError(null);
    setDetailOpen(true);
  }

  return (
    <>
      <article className="mogu-elevated flex items-center gap-3 rounded-2xl border border-border p-3">
        <button
          type="button"
          className="shrink-0"
          onClick={openDetail}
          aria-label="スポット詳細を開く"
        >
          {photo ? (
            <AuthImage
              objectUrl={photo}
              alt=""
              className="size-12 rounded-xl object-cover"
            />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground">
              店
            </span>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="block w-full truncate text-left text-sm font-medium text-foreground"
            onClick={openDetail}
          >
            <SpotPlaceName
              placeId={item.spot.placeId}
              fallback={titleFallback}
              placeName={placeName}
            />
          </button>
          <p className="truncate text-xs text-muted-foreground">
            <Link
              href={actorProfilePath(item.actor.id, viewerId)}
              className="hover:underline"
            >
              {formatViaLabel(item.actor.displayName)}
            </Link>
            {placeName && item.spot.comment ? ` · ${item.spot.comment}` : ""}
          </p>
          {error ? (
            <p className="mt-1 text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0"
          disabled={busy || saved}
          onClick={() => void handleSave()}
        >
          {saved ? "保存済み" : "保存"}
        </Button>
      </article>

      <FeedSpotDetailSheet
        item={item}
        place={place}
        placeName={placeName}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        saved={saved}
        busy={busy}
        error={error}
        viewerId={viewerId}
        onSave={() => void handleSave()}
      />
    </>
  );
}
