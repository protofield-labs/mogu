"use client";

import Link from "next/link";

import { SpotPlaceName } from "@/components/places/spot-place-name";
import { SpotThumbnail } from "@/components/places/spot-thumbnail";
import { formatRatingChip, formatSavedCountBadge } from "@/lib/home/feed-labels";
import { usePlace } from "@/lib/places/use-place";
import type { SpotDto } from "@/lib/spot/types";

/** Minimal spot fields for list rows (#295). */
export type SpotListRowSpot = Pick<
  SpotDto,
  "id" | "placeId" | "photoUrls" | "comment" | "rating" | "savedCount"
>;

export type SpotListRowProps = {
  spot: SpotListRowSpot;
  placeName?: string | null;
  distanceLabel?: string;
  /** Renders the row as a full-width button (mypage collection detail). */
  onSelect?: (spot: SpotListRowSpot) => void;
  /** Link the title to a spot detail page (friend collections). */
  href?: string;
  /** Extra block below the main row (e.g. SpotSaveFooter). */
  footer?: React.ReactNode;
  showComment?: boolean;
  /** Short CTA under meta when the row is a button (agent candidate cards #314). */
  actionLabel?: string;
  disabled?: boolean;
};

/** Shared spot list row: SpotThumbnail + SpotPlaceName + meta (#295). */
export function SpotListRow({
  spot,
  placeName,
  distanceLabel,
  onSelect,
  href,
  footer,
  showComment = true,
  actionLabel,
  disabled = false,
}: SpotListRowProps) {
  const needsPlacePhoto = spot.photoUrls.length === 0;
  const { place, placeName: fetchedPlaceName, loading: placeLoading } =
    usePlace(spot.placeId);

  const metaLine = [
    formatRatingChip(spot.rating),
    formatSavedCountBadge(spot.savedCount),
    distanceLabel,
  ]
    .filter(Boolean)
    .join(" ・ ");

  const resolvedPlaceName = placeName ?? fetchedPlaceName ?? null;
  const showCommentLine =
    showComment &&
    Boolean(spot.comment?.trim()) &&
    Boolean(resolvedPlaceName?.trim());

  const title = (
    <p className="text-sm font-medium text-foreground">
      <SpotPlaceName
        placeId={spot.placeId}
        fallback={spot.comment || "スポット"}
        placeName={resolvedPlaceName}
        loading={!resolvedPlaceName && placeLoading}
      />
    </p>
  );

  const main = (
    <div className="flex gap-3">
      <SpotThumbnail
        spot={spot}
        place={place}
        placeLoading={needsPlacePhoto && placeLoading}
        className="size-16 shrink-0 rounded-xl object-cover"
        placeholder="label"
        placeholderLabel="写真なし"
      />
      <div className="min-w-0 flex-1">
        {href ? (
          <Link href={href} className="block min-w-0">
            {title}
          </Link>
        ) : (
          title
        )}
        {showCommentLine ? (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {spot.comment}
          </p>
        ) : null}
        {metaLine ? (
          <p className="mt-1 text-xs text-muted-foreground">{metaLine}</p>
        ) : null}
        {actionLabel && onSelect ? (
          <p className="mt-1 text-xs font-medium text-primary">{actionLabel}</p>
        ) : null}
      </div>
    </div>
  );

  if (onSelect) {
    return (
      <>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelect(spot)}
          aria-label={
            actionLabel
              ? `${resolvedPlaceName || spot.comment || "候補のお店"} — ${actionLabel}`
              : undefined
          }
          className="w-full rounded-2xl bg-mogu-surface-elevated p-4 text-left shadow-mogu-card transition-colors hover:bg-muted/30 disabled:opacity-60"
        >
          {main}
        </button>
        {footer}
      </>
    );
  }

  return (
    <div className="rounded-2xl bg-mogu-surface-elevated p-4 shadow-mogu-card">
      {main}
      {footer}
    </div>
  );
}
