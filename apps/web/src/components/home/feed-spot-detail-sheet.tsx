"use client";

import { useEffect, useRef } from "react";
import { XIcon } from "lucide-react";

import { UserAvatar } from "@/components/home/user-avatar";
import { GoogleMapsAttribution } from "@/components/places/google-maps-attribution";
import { AuthImage } from "@/components/mypage/auth-image";
import { Button } from "@/components/ui/button";
import {
  googleMapsPlaceUrl,
  openNowLabel,
} from "@/lib/agent/chat-helpers";
import type { PlaceDTO } from "@/lib/agent/types";
import {
  formatRatingChip,
  formatSpotTagChips,
  formatViaLabel,
} from "@/lib/home/feed-labels";
import type { FeedItem } from "@/lib/home/types";

type FeedSpotDetailSheetProps = {
  item: FeedItem;
  place: PlaceDTO | null;
  placeName: string | null;
  open: boolean;
  onClose: () => void;
  saved: boolean;
  busy: boolean;
  error: string | null;
  onSave: () => void;
};

export function FeedSpotDetailSheet({
  item,
  place,
  placeName,
  open,
  onClose,
  saved,
  busy,
  error,
  onSave,
}: FeedSpotDetailSheetProps) {
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

  const { spot, actor } = item;
  const tagChips = formatSpotTagChips(spot);
  const title = placeName ?? (spot.comment || item.collectionName);
  const showComment = Boolean(spot.comment && placeName);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[min(90dvh,720px)] w-full max-w-none rounded-t-2xl border border-border bg-mogu-surface-elevated p-0 shadow-lg backdrop:bg-black/40 sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(85dvh,720px)] sm:w-[min(100%,28rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
    >
      <div className="flex max-h-[inherit] flex-col">
        <div className="flex items-center justify-between border-b border-border px-mogu-screen-x py-3">
          <div className="flex min-w-0 items-center gap-2">
            <UserAvatar
              displayName={actor.displayName}
              avatarColor={actor.avatarColor}
              size="md"
            />
            <p className="truncate text-sm text-muted-foreground">
              {formatViaLabel(actor.displayName)}
            </p>
          </div>
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
          {spot.photoUrls.length > 0 ? (
            <div className="mb-4 flex snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {spot.photoUrls.map((url) => (
                <AuthImage
                  key={url}
                  objectUrl={url}
                  alt=""
                  className="aspect-[4/3] w-full shrink-0 snap-center rounded-xl object-cover"
                />
              ))}
            </div>
          ) : null}

          <h2 className="text-lg font-semibold text-foreground">{title}</h2>

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

          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href={googleMapsPlaceUrl(spot.placeId)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 items-center justify-center rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted hover:text-foreground"
            >
              地図で開く
            </a>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy || saved}
              onClick={onSave}
            >
              {saved ? "保存済み" : "保存"}
            </Button>
          </div>

          {error ? (
            <p className="mt-2 text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <GoogleMapsAttribution className="mt-4 text-[0.65rem] text-muted-foreground" />
        </div>
      </div>
    </dialog>
  );
}
