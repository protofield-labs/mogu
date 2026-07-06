"use client";

import { ChevronRight, Star } from "lucide-react";
import { useRouter } from "next/navigation";

import { AuthImage } from "@/components/mypage/auth-image";
import type { Recommendation } from "@/lib/home/types";
import { stashPendingRecommendation } from "@/lib/home/pending-recommendation";

type RecommendationCompactRowProps = {
  recommendation: Recommendation;
};

export function RecommendationCompactRow({
  recommendation,
}: RecommendationCompactRowProps) {
  const router = useRouter();
  const photo = recommendation.spot.photoUrls[0];

  function handleOpenSearch() {
    stashPendingRecommendation(recommendation);
    router.push("/search");
  }

  return (
    <button
      type="button"
      onClick={handleOpenSearch}
      className="mogu-elevated mx-mogu-screen-x flex w-[calc(100%-2*var(--mogu-spacing-screen-x))] items-center gap-3 rounded-2xl border border-border p-3 text-left transition-colors hover:bg-muted/40"
    >
      {photo ? (
        <AuthImage
          objectUrl={photo}
          alt=""
          className="size-12 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground">
          店
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-semibold text-primary">
          <Star className="size-3 fill-current" aria-hidden />
          一推し
        </span>
        <span className="mt-1 block truncate text-sm font-medium text-foreground">
          {recommendation.assertion}
        </span>
      </span>

      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}
