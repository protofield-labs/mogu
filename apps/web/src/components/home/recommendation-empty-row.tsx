"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

/** Show fallback CTA only when the user has enough spots for meaningful picks. */
export const MIN_SPOTS_FOR_RECOMMENDATION_EMPTY = 10;

type RecommendationEmptyRowProps = {
  ownSpotCount: number;
};

/**
 * Fallback when GET /home/recommendation is 404 (no pick for today).
 * Hidden until the user has enough own spots (#91 UX).
 */
export function RecommendationEmptyRow({
  ownSpotCount,
}: RecommendationEmptyRowProps) {
  if (ownSpotCount < MIN_SPOTS_FOR_RECOMMENDATION_EMPTY) {
    return null;
  }

  return (
    <Link
      href="/search"
      className="mx-mogu-screen-x flex items-center justify-between rounded-2xl border border-dashed border-border bg-mogu-surface-elevated px-4 py-3 text-sm text-foreground"
    >
      <span>今夜どこ行く？ 検索で断言を見る</span>
      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
    </Link>
  );
}
