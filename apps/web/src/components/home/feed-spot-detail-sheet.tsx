"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

import { SpotDetailSheet } from "@/components/spots/spot-detail-sheet";
import { UserAvatar } from "@/components/home/user-avatar";
import { ShareButton } from "@/components/share/share-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { googleMapsPlaceUrl } from "@/lib/agent/chat-helpers";
import type { PlaceDTO } from "@/lib/agent/types";
import { formatViaLabel } from "@/lib/home/feed-labels";
import type { FeedItem } from "@/lib/home/types";
import { actorProfilePath } from "@/lib/friends/paths";
import { spotShareUrl } from "@/lib/share/share-url";
import { cn } from "@/lib/utils";

type FeedSpotDetailSheetProps = {
  item: FeedItem;
  place: PlaceDTO | null;
  placeName: string | null;
  open: boolean;
  onClose: () => void;
  saved: boolean;
  busy: boolean;
  error: string | null;
  viewerId?: string | null;
  showSaveActions?: boolean;
  saveHandlers?: Pick<
    ComponentProps<typeof Button>,
    | "onPointerDown"
    | "onPointerUp"
    | "onPointerLeave"
    | "onPointerCancel"
    | "onKeyDown"
  >;
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
  viewerId,
  showSaveActions = true,
  saveHandlers,
}: FeedSpotDetailSheetProps) {
  const { spot, actor } = item;
  const canSave = showSaveActions && saveHandlers !== undefined;

  return (
    <SpotDetailSheet
      spot={spot}
      place={place}
      placeName={placeName}
      titleFallback={item.collectionName}
      open={open}
      onClose={onClose}
      header={
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={actorProfilePath(actor.id, viewerId)}
            className="flex min-w-0 flex-1 items-center gap-2"
            onClick={onClose}
          >
            <UserAvatar
              displayName={actor.displayName}
              avatarColor={actor.avatarColor}
              avatarUrl={actor.avatarUrl}
              size="md"
            />
            <p className="truncate text-sm text-muted-foreground">
              {formatViaLabel(actor.displayName)}
            </p>
          </Link>
          <ShareButton url={spotShareUrl(spot.id)} className="shrink-0" />
        </div>
      }
      footer={
        <>
          {canSave ? (
            <Button
              type="button"
              className="w-full"
              disabled={busy}
              aria-pressed={saved}
              {...saveHandlers}
            >
              {saved ? "保存済み" : "保存する"}
            </Button>
          ) : null}
          <a
            href={googleMapsPlaceUrl({
              placeId: spot.placeId,
              name: placeName,
              location: place?.location,
            })}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline" }), "w-full")}
          >
            地図で開く
          </a>
          {canSave && error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </>
      }
    />
  );
}
