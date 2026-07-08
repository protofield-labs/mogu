"use client";

import Link from "next/link";

import { GoogleMapsAttribution } from "@/components/places/google-maps-attribution";
import { Button } from "@/components/ui/button";
import { formatRatingChip } from "@/lib/home/feed-labels";
import type { Spot } from "@/lib/spots/browser-api";

type CollectionSpotMapCardProps = {
  spot: Spot;
  placeName: string | null;
  collectionLabel?: string;
  onOpenDetail?: () => void;
  detailHref?: string;
  onClose: () => void;
};

export function CollectionSpotMapCard({
  spot,
  placeName,
  collectionLabel,
  onOpenDetail,
  detailHref,
  onClose,
}: CollectionSpotMapCardProps) {
  const title = placeName ?? spot.comment ?? "スポット";

  return (
    <div className="pointer-events-auto absolute inset-x-4 bottom-4 z-10 rounded-2xl bg-mogu-surface-elevated p-4 shadow-mogu-card-hover">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          {spot.comment && placeName ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {spot.comment}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            {formatRatingChip(spot.rating)}
          </p>
          {collectionLabel ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {collectionLabel}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="閉じる"
          onClick={onClose}
        >
          ×
        </Button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        {onOpenDetail ? (
          <Button type="button" size="sm" className="flex-1" onClick={onOpenDetail}>
            詳細を見る
          </Button>
        ) : detailHref ? (
          <Link
            href={detailHref}
            className="inline-flex h-7 flex-1 items-center justify-center rounded-[min(var(--radius-md),12px)] bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground hover:bg-primary/80"
          >
            詳細を見る
          </Link>
        ) : null}
        <GoogleMapsAttribution className="text-[0.65rem] text-muted-foreground" />
      </div>
    </div>
  );
}
