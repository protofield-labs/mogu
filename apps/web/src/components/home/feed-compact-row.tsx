"use client";

import Link from "next/link";

import { FeedSpotDetailSheet } from "@/components/home/feed-spot-detail-sheet";
import { SpotPlaceName } from "@/components/places/spot-place-name";
import { AuthImage } from "@/components/mypage/auth-image";
import { RecollectPicker } from "@/components/recollect/recollect-picker";
import { useFeedSpotSave } from "@/lib/recollect/use-feed-spot-save";
import { Button } from "@/components/ui/button";
import { formatViaLabel } from "@/lib/home/feed-labels";
import type { FeedItem } from "@/lib/home/types";
import { actorProfilePath } from "@/lib/friends/paths";
import { usePlace } from "@/lib/places/use-place";

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
  const photo = item.spot.photoUrls[0];
  const titleFallback = item.spot.comment || item.collectionName;

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
          {recollect.error ? (
            <p className="mt-1 text-xs text-destructive" role="alert">
              {recollect.error}
            </p>
          ) : null}
        </div>

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
        saveHandlers={recollect.saveHandlers}
      />

      <RecollectPicker spotId={item.spot.id} recollect={recollect} />
    </>
  );
}
