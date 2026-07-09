"use client";

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";

import { SpotSaveFooter } from "@/components/recollect/spot-save-footer";
import { SpotDetailSheet } from "@/components/spots/spot-detail-sheet";
import { Badge } from "@/components/ui/badge";
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
        <SpotSaveFooter spotId={spot.id} recollect={recollect}>
          <SpotSaveFooter.SaveButton className="w-full" />
          <SpotSaveFooter.MapLink
            placeId={spot.placeId}
            placeName={placeName}
            place={place}
            className="w-full"
          />
          <SpotSaveFooter.ConsultAgent onClick={handleConsultAgent}>
            エージェントに相談
          </SpotSaveFooter.ConsultAgent>
          <SpotSaveFooter.Error />
          <SpotSaveFooter.Picker />
        </SpotSaveFooter>
      }
    />
  );
}
