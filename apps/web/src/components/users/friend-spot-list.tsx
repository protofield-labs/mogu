"use client";

import { Bookmark } from "lucide-react";
import Link from "next/link";

import { AuthImage } from "@/components/mypage/auth-image";
import { SpotSaveFooter } from "@/components/recollect/spot-save-footer";
import { useRecollect } from "@/lib/recollect/use-recollect";
import { EmptyState } from "@/components/ui/empty-state";
import {
  formatRatingChip,
  formatSavedCountBadge,
} from "@/lib/home/feed-labels";
import { spotPath } from "@/lib/share/paths";
import type { Spot } from "@/lib/spots/browser-api";

type FriendSpotListProps = {
  spots: Spot[];
};

export function FriendSpotList({ spots }: FriendSpotListProps) {
  if (spots.length === 0) {
    return (
      <EmptyState className="rounded-2xl p-4">
        まだスポットがありません。
      </EmptyState>
    );
  }

  return (
    <ul className="space-y-3">
      {spots.map((spot) => (
        <FriendSpotRow key={spot.id} spot={spot} />
      ))}
    </ul>
  );
}

function FriendSpotRow({ spot }: { spot: Spot }) {
  const recollect = useRecollect(spot.id);

  return (
    <li className="rounded-2xl bg-mogu-surface-elevated p-4 shadow-mogu-card">
      <div className="flex gap-3">
        {spot.photoUrls[0] ? (
          <AuthImage
            objectUrl={spot.photoUrls[0]}
            alt=""
            className="size-16 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div className="size-16 shrink-0 rounded-xl bg-muted" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <Link href={spotPath(spot.id)} className="block min-w-0">
            <p className="text-sm font-medium text-foreground">
              {spot.comment || spot.placeId}
            </p>
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            {[formatRatingChip(spot.rating), formatSavedCountBadge(spot.savedCount)]
              .filter(Boolean)
              .join(" ・ ")}
          </p>
        </div>
      </div>
      <SpotSaveFooter spotId={spot.id} recollect={recollect}>
        <div className="mt-3">
          <SpotSaveFooter.SaveButton
            label="保存"
            icon={<Bookmark className="size-3.5" aria-hidden />}
            variant="secondary"
            size="sm"
            className="w-full"
          />
          <SpotSaveFooter.Error className="mt-2" />
        </div>
        <SpotSaveFooter.Picker />
      </SpotSaveFooter>
    </li>
  );
}
