"use client";

import { Bookmark } from "lucide-react";

import { AuthImage } from "@/components/mypage/auth-image";
import { RecollectPicker } from "@/components/recollect/recollect-picker";
import { useRecollect } from "@/lib/recollect/use-recollect";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  formatRatingChip,
  formatSavedCountBadge,
} from "@/lib/home/feed-labels";
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
    <li className="rounded-2xl border border-border bg-mogu-surface-elevated p-4">
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
          <p className="text-sm font-medium text-foreground">
            {spot.comment || spot.placeId}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {[formatRatingChip(spot.rating), formatSavedCountBadge(spot.savedCount)]
              .filter(Boolean)
              .join(" ・ ")}
          </p>
        </div>
      </div>
      <div className="mt-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full"
          disabled={recollect.busy}
          aria-pressed={recollect.saved}
          {...recollect.saveHandlers}
        >
          <Bookmark className="size-3.5" aria-hidden />
          {recollect.saved ? "保存済み" : "保存"}
        </Button>
        {recollect.error ? (
          <p className="mt-2 text-xs text-destructive" role="alert">
            {recollect.error}
          </p>
        ) : null}
      </div>

      <RecollectPicker spotId={spot.id} recollect={recollect} />
    </li>
  );
}
