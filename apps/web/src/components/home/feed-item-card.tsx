"use client";

import Link from "next/link";
import { useRef } from "react";

import { FeedSpotDetailSheet } from "@/components/home/feed-spot-detail-sheet";
import { UserAvatar } from "@/components/home/user-avatar";
import { SpotPlaceName } from "@/components/places/spot-place-name";
import { SpotThumbnail } from "@/components/places/spot-thumbnail";
import { AuthImage } from "@/components/mypage/auth-image";
import { RecollectPicker } from "@/components/recollect/recollect-picker";
import { useFeedSpotSave } from "@/lib/recollect/use-feed-spot-save";
import { Button } from "@/components/ui/button";
import {
  formatRatingChip,
  formatSavedCountBadge,
} from "@/lib/home/feed-labels";
import { canRecollectFeedItem } from "@/lib/home/feed-item";
import type { FeedItem } from "@/lib/home/types";
import { actorProfilePath } from "@/lib/friends/paths";
import { usePlace } from "@/lib/places/use-place";
import { moguEnterDelayStyle, moguEnterMotionClass } from "@/lib/ui/motion";
import { touchRowClass } from "@/lib/ui/touch-feedback";
import { cn } from "@/lib/utils";

type FeedItemCardProps = {
  item: FeedItem;
  viewerId?: string | null;
  /** Stagger index for first-paint enter motion (#128). */
  enterIndex?: number;
};

/** Borderless Instagram-style feed item: header → media → actions → caption (#192). */
export function FeedItemCard({ item, viewerId, enterIndex }: FeedItemCardProps) {
  const { recollect, detailOpen, openDetail, closeDetail } = useFeedSpotSave(
    item.spot.id,
    { initialSaved: item.savedByMe },
  );
  const touchStartX = useRef(0);
  const didScroll = useRef(false);
  const { place, placeName, loading: placeLoading } = usePlace(item.spot.placeId);
  const savedBadge = formatSavedCountBadge(item.spot.savedCount);
  const titleFallback = item.spot.comment || item.collectionName;
  const showSaveActions = canRecollectFeedItem(item, viewerId);

  function handlePhotoTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    touchStartX.current = event.touches[0]?.clientX ?? 0;
    didScroll.current = false;
  }

  function handlePhotoTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    const x = event.touches[0]?.clientX ?? 0;
    if (Math.abs(x - touchStartX.current) > 8) {
      didScroll.current = true;
    }
  }

  function handlePhotoActivate() {
    if (!didScroll.current) {
      openDetail();
    }
  }

  return (
    <>
      <article
        className={cn(
          "border-b border-border/50 pb-5 pt-3 first:pt-0 last:border-b-0",
          enterIndex !== undefined && moguEnterMotionClass,
        )}
        style={moguEnterDelayStyle(enterIndex)}
      >
        <header className="flex items-center gap-2.5 px-mogu-screen-x pb-2.5">
          <Link
            href={actorProfilePath(item.actor.id, viewerId)}
            className={cn("flex min-w-0 items-center gap-2.5", touchRowClass)}
          >
            <UserAvatar
              displayName={item.actor.displayName}
              avatarColor={item.actor.avatarColor}
              size="md"
            />
            <span className="truncate text-sm font-semibold text-foreground">
              {item.actor.displayName}
            </span>
          </Link>
        </header>

        <div className="relative w-full">
          {item.spot.photoUrls.length > 0 ? (
            <div
              role="button"
              tabIndex={0}
              aria-label="スポット詳細を開く"
              onClick={handlePhotoActivate}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openDetail();
                }
              }}
              onTouchStart={handlePhotoTouchStart}
              onTouchMove={handlePhotoTouchMove}
              className="block w-full cursor-pointer text-left"
            >
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
            </div>
          ) : (
            <button
              type="button"
              className={cn("block w-full text-left", touchRowClass)}
              onClick={openDetail}
              aria-label="スポット詳細を開く"
            >
              <SpotThumbnail
                spot={item.spot}
                place={place}
                placeLoading={placeLoading}
                showMapsAttribution
                className="aspect-[4/3] w-full"
                placeholder="label"
                placeholderLabel="写真なし"
              />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-mogu-screen-x pt-2.5">
          <span className="text-xs font-semibold text-foreground">
            {formatRatingChip(item.spot.rating)}
          </span>
          {savedBadge ? (
            <span className="text-xs text-muted-foreground">{savedBadge}</span>
          ) : null}
          {showSaveActions ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs font-semibold"
              disabled={recollect.busy}
              aria-pressed={recollect.saved}
              {...recollect.saveHandlers}
            >
              {recollect.saved ? "保存済み" : "保存"}
            </Button>
          ) : null}
        </div>

        {showSaveActions && recollect.error ? (
          <p
            className="px-mogu-screen-x pt-1 text-xs text-destructive"
            role="alert"
          >
            {recollect.error}
          </p>
        ) : null}

        <div className="space-y-1 px-mogu-screen-x pt-1.5">
          <button
            type="button"
            className={cn("block w-full text-left", touchRowClass)}
            onClick={openDetail}
          >
            <p className="text-sm font-semibold text-foreground">
              <SpotPlaceName
                placeId={item.spot.placeId}
                fallback={titleFallback}
                placeName={placeName}
              />
            </p>
          </button>
          {placeName && item.spot.comment ? (
            <p className="text-sm leading-snug text-foreground">
              {item.spot.comment}
            </p>
          ) : null}
        </div>
      </article>

      <FeedSpotDetailSheet
        item={item}
        place={place}
        placeName={placeName}
        open={detailOpen}
        onClose={closeDetail}
        saved={recollect.saved}
        busy={recollect.busy}
        error={recollect.error}
        viewerId={viewerId}
        showSaveActions={showSaveActions}
        saveHandlers={recollect.saveHandlers}
      />

      {showSaveActions ? (
        <RecollectPicker spotId={item.spot.id} recollect={recollect} />
      ) : null}
    </>
  );
}
