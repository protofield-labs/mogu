"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import {
  HOME_RECOMMENDATION_OWN_HINT,
  HOME_RECOMMENDATION_SOLO_HINT,
} from "@/lib/home/recommendation-labels";

/** Show fallback CTA only when the user has enough spots for meaningful picks. */
export const MIN_SPOTS_FOR_RECOMMENDATION_EMPTY = 10;

type RecommendationEmptyRowProps = {
  ownSpotCount: number;
  friendCount: number;
};

/**
 * Fallback when GET /home/recommendation has no today or previous pick (204).
 */
export function RecommendationEmptyRow({
  ownSpotCount,
  friendCount,
}: RecommendationEmptyRowProps) {
  if (friendCount === 0) {
    return (
      <div className="mx-mogu-screen-x shrink-0 rounded-2xl border border-dashed border-border bg-mogu-surface-elevated px-4 py-3 text-sm text-muted-foreground">
        {HOME_RECOMMENDATION_SOLO_HINT}
      </div>
    );
  }

  if (ownSpotCount < MIN_SPOTS_FOR_RECOMMENDATION_EMPTY) {
    return (
      <div className="mx-mogu-screen-x shrink-0 rounded-2xl border border-dashed border-border bg-mogu-surface-elevated px-4 py-3 text-sm text-muted-foreground">
        {HOME_RECOMMENDATION_OWN_HINT}
      </div>
    );
  }

  return (
    <Link
      href="/search"
      className="mx-mogu-screen-x flex shrink-0 items-center justify-between rounded-2xl border border-dashed border-border bg-mogu-surface-elevated px-4 py-3 text-sm text-foreground"
    >
      <span>今夜どこ行く？ 検索で断言を見る</span>
      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
    </Link>
  );
}
