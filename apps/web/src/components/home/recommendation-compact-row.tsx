"use client";

import { ChevronRight, Star } from "lucide-react";
import { useRouter } from "next/navigation";

import { AuthImage } from "@/components/mypage/auth-image";
import { PlacePhotoImage } from "@/components/places/place-photo-image";
import { Badge } from "@/components/ui/badge";
import type { Recommendation } from "@/lib/home/types";
import { HOME_RECOMMENDATION_LABEL } from "@/lib/home/recommendation-labels";
import { stashPendingRecommendation } from "@/lib/home/pending-recommendation";
import { resolveSpotHeroPhoto } from "@/lib/places/resolve-spot-hero-photo";
import { usePlace } from "@/lib/places/use-place";
import { touchCardClass } from "@/lib/ui/touch-feedback";
import { cn } from "@/lib/utils";

type RecommendationCompactRowProps = {
  recommendation: Recommendation;
};

export function RecommendationCompactRow({
  recommendation,
}: RecommendationCompactRowProps) {
  const router = useRouter();
  const { place } = usePlace(recommendation.spot.placeId);
  const heroPhoto = resolveSpotHeroPhoto(recommendation.spot, place);

  function handleOpenSearch() {
    stashPendingRecommendation(recommendation);
    router.push("/search");
  }

  return (
    <button
      type="button"
      onClick={handleOpenSearch}
      className={cn(
        "mogu-elevated mx-mogu-screen-x flex w-[calc(100%-2*var(--mogu-spacing-screen-x))] items-center gap-3 rounded-2xl border border-border p-3 text-left transition-colors hover:bg-muted/40",
        touchCardClass,
      )}
    >
      {heroPhoto?.source === "spot" ? (
        <AuthImage
          objectUrl={heroPhoto.url}
          alt=""
          className="size-12 shrink-0 rounded-xl object-cover"
        />
      ) : heroPhoto?.source === "place" ? (
        <PlacePhotoImage
          url={heroPhoto.url}
          alt=""
          className="size-12 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground">
          店
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="inline-flex items-center gap-1">
          <Badge variant="accent">
            <Star className="size-3 fill-current" aria-hidden />
            {HOME_RECOMMENDATION_LABEL}
          </Badge>
        </span>
        <span className="mt-1 block truncate text-sm font-medium text-foreground">
          {recommendation.assertion}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {recommendation.evidence}
        </span>
      </span>

      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}
