"use client";

import Link from "next/link";

import { FeedSpotDetailSheet } from "@/components/home/feed-spot-detail-sheet";
import { SpotPlaceName } from "@/components/places/spot-place-name";
import { SpotThumbnail } from "@/components/places/spot-thumbnail";
import { RecollectPicker } from "@/components/recollect/recollect-picker";
import { useFeedSpotSave } from "@/lib/recollect/use-feed-spot-save";
import { Button } from "@/components/ui/button";
import { formatViaLabel } from "@/lib/home/feed-labels";
import { canRecollectFeedItem } from "@/lib/home/feed-item";
import type { FeedItem } from "@/lib/home/types";
import { actorProfilePath } from "@/lib/friends/paths";
import { usePlace } from "@/lib/places/use-place";
import { touchCardClass, touchRowClass } from "@/lib/ui/touch-feedback";
import { cn } from "@/lib/utils";

type FeedCompactRowProps = {
  item: FeedItem;
  viewerId?: string | null;
};

export function FeedCompactRow({ item, viewerId }: FeedCompactRowProps) {
  const { recollect, detailOpen, openDetail, closeDetail } = useFeedSpotSave(
    item.spot.id,
    { initialSaved: item.savedByMe },
  );
  const { place, placeName } = usePlace(item.spot.placeId);
  const titleFallback = item.spot.comment || item.collectionName;
  const showSaveActions = canRecollectFeedItem(item, viewerId);

  return (
    <>
      <article
        className={cn(
          "mogu-elevated flex items-center gap-3 rounded-2xl border border-border p-3",
          touchCardClass,
        )}
      >
        <button
          type="button"
          className={cn("shrink-0", touchRowClass)}
          onClick={openDetail}
          aria-label="スポット詳細を開く"
        >
          <SpotThumbnail
            spot={item.spot}
            place={place}
            className="size-12 rounded-xl object-cover"
          />
        </button>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            className={cn(
              "block w-full truncate text-left text-sm font-medium text-foreground",
              touchRowClass,
            )}
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
          {showSaveActions && recollect.error ? (
            <p className="mt-1 text-xs text-destructive" role="alert">
              {recollect.error}
            </p>
          ) : null}
        </div>

        {showSaveActions ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0"
            disabled={recollect.busy}
            aria-pressed={recollect.saved}
            {...recollect.saveHandlers}
          >
            {recollect.saved ? "保存済み" : "保存"}
          </Button>
        ) : null}
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
