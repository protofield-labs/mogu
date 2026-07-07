"use client";

import { Bookmark } from "lucide-react";
import { useState } from "react";

import { AuthImage } from "@/components/mypage/auth-image";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { recollectFeedSpot } from "@/lib/home/recollect-spot";
import {
  formatRatingChip,
  formatSavedCountBadge,
} from "@/lib/home/feed-labels";
import type { Spot } from "@/lib/spots/browser-api";
import { showRecollectSuccessToast } from "@/lib/ui/recollect-toast";

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
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setBusy(true);
    setError(null);
    const result = await recollectFeedSpot(spot.id);
    setBusy(false);
    if (result.ok) {
      setSaved(true);
      showRecollectSuccessToast(result.collectionName);
    } else {
      setError(result.error);
    }
  }

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
          disabled={busy || saved}
          onClick={() => void handleSave()}
        >
          <Bookmark className="size-3.5" aria-hidden />
          {saved ? "保存済み" : "保存"}
        </Button>
        {error ? (
          <p className="mt-2 text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </li>
  );
}
