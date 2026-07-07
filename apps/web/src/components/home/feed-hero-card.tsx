"use client";

import Link from "next/link";
import { useState } from "react";

import { FeedSpotDetailSheet } from "@/components/home/feed-spot-detail-sheet";
import { UserAvatar } from "@/components/home/user-avatar";
import { SpotPlaceName } from "@/components/places/spot-place-name";
import { AuthImage } from "@/components/mypage/auth-image";
import { Button } from "@/components/ui/button";
import {
  formatRatingChip,
  formatSavedCountBadge,
  formatViaLabel,
} from "@/lib/home/feed-labels";
import { recollectFeedSpot } from "@/lib/home/recollect-spot";
import type { FeedItem } from "@/lib/home/types";
import { actorProfilePath } from "@/lib/friends/paths";
import { showRecollectSuccessToast } from "@/lib/ui/recollect-toast";
import { usePlace } from "@/lib/places/use-place";

type FeedHeroCardProps = {
  item: FeedItem;
  viewerId?: string | null;
};

export function FeedHeroCard({ item, viewerId }: FeedHeroCardProps) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { place, placeName } = usePlace(item.spot.placeId);
  const savedBadge = formatSavedCountBadge(item.spot.savedCount);
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
      <article className="mogu-elevated overflow-hidden rounded-2xl border border-border">
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
            <button
              type="button"
              className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-sm text-muted-foreground"
              onClick={openDetail}
            >
              写真なし
            </button>
          )}
          {savedBadge ? (
            <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground backdrop-blur-sm">
              {savedBadge}
            </span>
          ) : null}
        </div>

        <div className="space-y-2 p-mogu-screen-x py-3">
          <Link
            href={actorProfilePath(item.actor.id, viewerId)}
            className="flex items-start gap-2"
          >
            <UserAvatar
              displayName={item.actor.displayName}
              avatarColor={item.actor.avatarColor}
              size="md"
            />
            <p className="pt-1 text-xs text-muted-foreground">
              {formatViaLabel(item.actor.displayName)}
            </p>
          </Link>
          <button
            type="button"
            className="block w-full text-left"
            onClick={openDetail}
          >
            <p className="text-sm font-semibold text-foreground">
              <SpotPlaceName
                placeId={item.spot.placeId}
                fallback={titleFallback}
                placeName={placeName}
              />
            </p>
            {placeName && item.spot.comment ? (
              <p className="mt-1 text-sm text-foreground">{item.spot.comment}</p>
            ) : null}
          </button>
        </div>

        <div className="space-y-3 px-mogu-screen-x pb-3">
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
