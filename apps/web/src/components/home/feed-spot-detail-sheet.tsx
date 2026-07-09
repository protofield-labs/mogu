"use client";

import Link from "next/link";

import { SpotDetailSheet } from "@/components/spots/spot-detail-sheet";
import { UserAvatar } from "@/components/home/user-avatar";
import { SpotSaveFooter } from "@/components/recollect/spot-save-footer";
import { ShareButton } from "@/components/share/share-button";
import type { PlaceDTO } from "@/lib/agent/types";
import { formatViaLabel } from "@/lib/home/feed-labels";
import type { FeedItem } from "@/lib/home/types";
import { actorProfilePath } from "@/lib/friends/paths";
import type { useRecollect } from "@/lib/recollect/use-recollect";
import { spotShareUrl } from "@/lib/share/share-url";

type FeedSpotDetailSheetProps = {
  item: FeedItem;
  place: PlaceDTO | null;
  placeName: string | null;
  open: boolean;
  onClose: () => void;
  viewerId?: string | null;
  showSaveActions?: boolean;
  recollect?: ReturnType<typeof useRecollect>;
};

export function FeedSpotDetailSheet({
  item,
  place,
  placeName,
  open,
  onClose,
  viewerId,
  showSaveActions = true,
  recollect,
}: FeedSpotDetailSheetProps) {
  const { spot, actor } = item;
  const canSave = showSaveActions && recollect !== undefined;

  const mapLink = (
    <SpotSaveFooter.MapLink
      placeId={spot.placeId}
      placeName={placeName}
      place={place}
      className="w-full"
    />
  );

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
        canSave ? (
          <SpotSaveFooter spotId={spot.id} recollect={recollect}>
            <SpotSaveFooter.SaveButton className="w-full" />
            {mapLink}
            <SpotSaveFooter.Error />
          </SpotSaveFooter>
        ) : (
          mapLink
        )
      }
    />
  );
}
