"use client";

import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RecommendationEmptyRowProps = {
  /** Own spot count from GET /me; 0 triggers onboarding-style CTA. */
  ownSpotCount: number;
};

/**
 * Fallback when GET /home/recommendation is 404 (no pick for today).
 * Spot-less users see the same onboarding message as HomeEmptyState (#54).
 */
export function RecommendationEmptyRow({
  ownSpotCount,
}: RecommendationEmptyRowProps) {
  if (ownSpotCount === 0) {
    return (
      <section className="mx-mogu-screen-x rounded-2xl border border-dashed border-border bg-mogu-surface-elevated px-4 py-4">
        <p className="text-sm font-medium text-foreground">
          まだ一推しがありません
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          最初のお店を記録して、今夜の候補を増やしましょう。
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/mypage"
            className={cn(buttonVariants(), "gap-1.5 justify-center")}
          >
            <Sparkles className="size-4" aria-hidden />
            最初のお店を追加
          </Link>
          <Link
            href="/search"
            className={cn(
              buttonVariants({ variant: "secondary" }),
              "gap-1.5 justify-center",
            )}
          >
            今夜どこ行く？ 検索する
          </Link>
        </div>
      </section>
    );
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
