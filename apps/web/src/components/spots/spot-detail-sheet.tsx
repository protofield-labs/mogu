"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { XIcon } from "lucide-react";

import { GoogleMapsAttribution } from "@/components/places/google-maps-attribution";
import { SpotDetailMedia } from "@/components/spots/spot-detail-media";
import { Button } from "@/components/ui/button";
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openNowLabelText = openNowLabel(place?.openNow);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const tagChips = formatSpotTagChips(spot);
  const title = placeName ?? (spot.comment || titleFallback);
  const showComment = Boolean(spot.comment && placeName);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[min(90dvh,720px)] w-full max-w-none rounded-t-2xl border border-border bg-mogu-surface-elevated p-0 shadow-lg backdrop:bg-black/40 sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(85dvh,720px)] sm:w-[min(100%,28rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
    >
      <div className="flex max-h-[inherit] flex-col">
        <div className="flex items-center justify-between border-b border-border px-mogu-screen-x py-3">
          <div className="min-w-0 flex-1">{header}</div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="閉じる"
            onClick={onClose}
          >
            <XIcon />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-mogu-screen-x py-4">
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
        </div>
      </div>
    </dialog>
  );
}
