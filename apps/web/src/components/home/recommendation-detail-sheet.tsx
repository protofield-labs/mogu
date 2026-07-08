"use client";

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";

import { RecollectPicker } from "@/components/recollect/recollect-picker";
import { SpotDetailSheet } from "@/components/spots/spot-detail-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { googleMapsPlaceUrl } from "@/lib/agent/chat-helpers";
import type { Recommendation } from "@/lib/home/types";
import { HOME_RECOMMENDATION_LABEL } from "@/lib/home/recommendation-labels";
import { stashPendingRecommendation } from "@/lib/home/pending-recommendation";
import { usePlace } from "@/lib/places/use-place";
import { useRecollect } from "@/lib/recollect/use-recollect";

type RecommendationDetailSheetProps = {
  recommendation: Recommendation;
  open: boolean;
  onClose: () => void;
};

export function RecommendationDetailSheet({
  recommendation,
  open,
  onClose,
}: RecommendationDetailSheetProps) {
  const router = useRouter();
  const { spot, assertion, evidence, savedByMe = false } = recommendation;
  const { place, placeName } = usePlace(spot.placeId);
  const recollect = useRecollect(spot.id, { initialSaved: savedByMe });

  function handleConsultAgent() {
    stashPendingRecommendation(recommendation);
    onClose();
    router.push("/search");
  }

  return (
    <SpotDetailSheet
      spot={spot}
      place={place}
      placeName={placeName}
      titleFallback={assertion}
      open={open}
      onClose={onClose}
      header={
        <Badge variant="accent">
          <Star className="size-3 fill-current" aria-hidden />
          {HOME_RECOMMENDATION_LABEL}
        </Badge>
      }
      extraBody={
        <div className="mt-4 space-y-2">
          <p className="text-sm font-semibold leading-snug text-foreground">
            {assertion}
          </p>
          <p className="text-sm text-muted-foreground">{evidence}</p>
        </div>
      }
      footer={
        <>
          <div className="flex flex-wrap gap-2">
            <a
              href={googleMapsPlaceUrl({
                placeId: spot.placeId,
                name: placeName,
                location: place?.location,
              })}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 items-center justify-center rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted hover:text-foreground"
            >
              地図で開く
            </a>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={recollect.busy}
              aria-pressed={recollect.saved}
              {...recollect.saveHandlers}
            >
              {recollect.saved ? "保存済み" : "保存"}
            </Button>
          </div>
          <Button type="button" className="w-full" onClick={handleConsultAgent}>
            エージェントに相談
          </Button>
          {recollect.error ? (
            <p className="text-xs text-destructive" role="alert">
              {recollect.error}
            </p>
          ) : null}
          <RecollectPicker spotId={spot.id} recollect={recollect} />
        </>
      }
    />
  );
}
