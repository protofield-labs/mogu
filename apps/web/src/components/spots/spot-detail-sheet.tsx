"use client";

import type { ReactNode } from "react";

import { GoogleMapsAttribution } from "@/components/places/google-maps-attribution";
import { SpotDetailMedia } from "@/components/spots/spot-detail-media";
import { Sheet, SheetBody, SheetHeader } from "@/components/ui/sheet";
import { openNowLabel } from "@/lib/agent/chat-helpers";
import type { PlaceDTO } from "@/lib/places/types";
import { formatRatingChip, formatSpotTagChips } from "@/lib/home/feed-labels";
import type { SpotDto } from "@/lib/spot/types";

export type SpotDetailSheetProps = {
  spot: Pick<
    SpotDto,
    | "placeId"
    | "photoUrls"
    | "comment"
    | "rating"
    | "structuredTags"
    | "freeTags"
  >;
  place: PlaceDTO | null;
  placeName: string | null;
  titleFallback?: string;
  open: boolean;
  onClose: () => void;
  header: ReactNode;
  footer: ReactNode;
};

export function SpotDetailSheet({
  spot,
  place,
  placeName,
  titleFallback = "スポット",
  open,
  onClose,
  header,
  footer,
}: SpotDetailSheetProps) {
  const openNowLabelText = openNowLabel(place?.openNow);
  const tagChips = formatSpotTagChips(spot);
  const title = placeName ?? (spot.comment || titleFallback);
  const showComment = Boolean(spot.comment && placeName);

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader>{header}</SheetHeader>

      <SheetBody>
        <SpotDetailMedia
          photoUrls={spot.photoUrls}
          place={place}
          placeName={placeName}
        />

        <h2 className="text-lg font-semibold text-foreground">{title}</h2>

        {place?.address ? (
          <p className="mt-1 text-sm text-muted-foreground">{place.address}</p>
        ) : null}

        {openNowLabelText ? (
          <p className="mt-1 text-xs font-medium text-primary">
            {openNowLabelText}
          </p>
        ) : null}

        {showComment ? (
          <p className="mt-3 text-sm text-foreground">{spot.comment}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground">
            {formatRatingChip(spot.rating)}
          </span>
          {tagChips.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-5 space-y-2">{footer}</div>

        <GoogleMapsAttribution className="mt-4 text-[0.65rem] text-muted-foreground" />
      </SheetBody>
    </Sheet>
  );
}
