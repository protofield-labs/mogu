"use client";

import Link from "next/link";
import { useRef } from "react";

import { FeedItemActions } from "@/components/home/feed-item-actions";
import { FeedSavedSavers } from "@/components/home/feed-saved-savers";
import { FeedSpotDetailSheet } from "@/components/home/feed-spot-detail-sheet";
import { UserAvatar } from "@/components/home/user-avatar";
import { SpotPlaceName } from "@/components/places/spot-place-name";
import { SpotThumbnail } from "@/components/places/spot-thumbnail";
import { AuthImage } from "@/components/mypage/auth-image";
import { RecollectPicker } from "@/components/recollect/recollect-picker";
import { useFeedSpotSave } from "@/lib/recollect/use-feed-spot-save";
import { canRecollectFeedItem } from "@/lib/home/feed-item";
import type { FeedItem } from "@/lib/home/types";
import { actorProfilePath } from "@/lib/friends/paths";
import { usePlace } from "@/lib/places/use-place";
import { moguEnterDelayStyle, moguEnterMotionClass } from "@/lib/ui/motion";
import { handleHorizontalCarouselKeyDown } from "@/lib/ui/horizontal-carousel-keydown";
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
  const { recollect, like, detailOpen, openDetail, closeDetail } = useFeedSpotSave(
    item.spot.id,
    {
      initialSaved: item.savedByMe,
      initialLikedByMe: item.likedByMe,
      initialLikeCount: item.likeCount,
    },
  );
  const touchStartX = useRef(0);
  const didScroll = useRef(false);
  const { place, placeName, loading: placeLoading } = usePlace(item.spot.placeId);
  const titleFallback = item.spot.comment || item.collectionName;
  const showSaveActions = canRecollectFeedItem(item, viewerId);
  const hasPhotoCarousel = item.spot.photoUrls.length > 1;

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
        <header className="px-mogu-screen-x pb-2.5">
          <Link
            href={actorProfilePath(item.actor.id, viewerId)}
            className={cn(
              "flex min-h-11 min-w-0 items-center gap-2.5",
              touchRowClass,
            )}
          >
            <UserAvatar
              displayName={item.actor.displayName}
              avatarColor={item.actor.avatarColor}
              size="md"
            />
            <span className="truncate text-sm font-semibold leading-tight text-foreground">
              {item.actor.displayName}
            </span>
          </Link>
        </header>

        <div className="relative w-full">
          {item.spot.photoUrls.length > 0 ? (
            hasPhotoCarousel ? (
              <div
                role="group"
                tabIndex={0}
                aria-label="写真"
                onClick={handlePhotoActivate}
                onKeyDown={(event) =>
                  handleHorizontalCarouselKeyDown(event, {
                    onActivate: openDetail,
                  })
                }
                onTouchStart={handlePhotoTouchStart}
                onTouchMove={handlePhotoTouchMove}
                className="flex w-full cursor-pointer snap-x snap-mandatory overflow-x-auto text-left [-ms-overflow-style:none] [scrollbar-width:none] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-scrollbar]:hidden"
              >
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
                className={cn("block w-full text-left", touchRowClass)}
                onClick={openDetail}
                aria-label="スポット詳細を開く"
              >
                <AuthImage
                  objectUrl={item.spot.photoUrls[0]}
                  alt=""
                  className="aspect-[4/3] w-full object-cover"
                />
              </button>
            )
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

        <FeedItemActions
          rating={item.spot.rating}
          likedByMe={like.likedByMe}
          likeCount={like.likeCount}
          likeBusy={like.busy}
          onToggleLike={like.toggleLike}
          saved={recollect.saved}
          busy={recollect.busy}
          showSaveActions={showSaveActions}
          saveHandlers={recollect.saveHandlers}
          onOpenDetail={openDetail}
        />

        {like.error ? (
          <p
            className="px-mogu-screen-x pt-1 text-xs text-destructive"
            role="alert"
          >
            {like.error}
          </p>
        ) : null}

        {showSaveActions && recollect.error ? (
          <p
            className="px-mogu-screen-x pt-1 text-xs text-destructive"
            role="alert"
          >
            {recollect.error}
          </p>
        ) : null}

        <FeedSavedSavers
          savers={item.savedSavers}
          savedCount={item.spot.savedCount}
        />

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
