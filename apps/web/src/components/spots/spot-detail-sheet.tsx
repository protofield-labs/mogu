"use client";

import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

import { GoogleMapsAttribution } from "@/components/places/google-maps-attribution";
import { SpotDetailMedia } from "@/components/spots/spot-detail-media";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetDragHandle,
  SheetFooter,
  SheetGrabber,
} from "@/components/ui/sheet";
import { openNowLabel } from "@/lib/places/maps-links";
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
  distanceLabel?: string | null;
  open: boolean;
  onClose: () => void;
  header?: ReactNode;
  footer: ReactNode;
  extraBody?: ReactNode;
};

export function SpotDetailSheet({
  spot,
  place,
  placeName,
  titleFallback = "スポット",
  distanceLabel = null,
  open,
  onClose,
  header,
  footer,
  extraBody,
}: SpotDetailSheetProps) {
  const openNowLabelText = openNowLabel(place?.openNow);
  const tagChips = formatSpotTagChips(spot);
  const title = placeName ?? (spot.comment || titleFallback);
  const showComment = Boolean(spot.comment && placeName);

  return (
    <Sheet open={open} onClose={onClose} ariaLabel={title}>
      <div className="relative shrink-0">
        <SpotDetailMedia
          photoUrls={spot.photoUrls}
          place={place}
          placeName={placeName}
          variant="hero"
        />
        <SheetDragHandle className="absolute inset-x-0 top-0 flex justify-center pt-2">
          <SheetGrabber className="bg-background/80" />
        </SheetDragHandle>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="閉じる"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full bg-background/90 shadow-sm backdrop-blur-sm"
        >
          <XIcon />
        </Button>
      </div>

      <SheetBody className="space-y-4 pt-4">
        {header ? <div className="min-w-0">{header}</div> : null}

        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {title}
          </h2>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="font-medium text-primary">
              {formatRatingChip(spot.rating)}
            </span>
            {distanceLabel ? <span>{distanceLabel}</span> : null}
            {openNowLabelText ? (
              <span className="font-medium text-primary">{openNowLabelText}</span>
            ) : null}
          </div>

          {place?.address ? (
            <p className="text-sm text-muted-foreground">{place.address}</p>
          ) : null}
        </div>

        {tagChips.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tagChips.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {showComment ? (
          <p className="text-sm leading-relaxed text-foreground">{spot.comment}</p>
        ) : null}

        {extraBody}

        <GoogleMapsAttribution className="text-[0.65rem] text-muted-foreground" />
      </SheetBody>

      <SheetFooter className="flex flex-col gap-2">{footer}</SheetFooter>
    </Sheet>
  );
}
