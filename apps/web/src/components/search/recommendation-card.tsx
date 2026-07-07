"use client";

import { ChevronDownIcon } from "lucide-react";

import { GoogleMapsAttribution } from "@/components/places/google-maps-attribution";
import { SpotPlaceName } from "@/components/places/spot-place-name";
import { AuthImage } from "@/components/mypage/auth-image";
import { RecollectPicker } from "@/components/recollect/recollect-picker";
import { useRecollect } from "@/lib/recollect/use-recollect";
import { Button } from "@/components/ui/button";
import {
  googleMapsPlaceUrl,
  openNowLabel,
} from "@/lib/agent/chat-helpers";
import type { Recommendation, Spot } from "@/lib/agent/types";
import { usePlace } from "@/lib/places/use-place";

type RecommendationCardProps = {
  recommendation: Recommendation;
};

function AlternativeSpotRow({ spot }: { spot: Spot }) {
  const recollect = useRecollect(spot.id);

  return (
    <li className="rounded-lg border border-border bg-background p-3">
      <SpotSummary spot={spot} compact />
      <div className="mt-2 flex flex-wrap gap-2">
        <a
          href={googleMapsPlaceUrl(spot.placeId)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-7 items-center justify-center rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted hover:text-foreground"
        >
          地図で開く
        </a>
        <Button
          variant="secondary"
          size="sm"
          disabled={recollect.busy}
          aria-pressed={recollect.saved}
          {...recollect.saveHandlers}
        >
          {recollect.saved ? "保存済み" : "リコレクション"}
        </Button>
      </div>
      {recollect.error ? (
        <p className="mt-2 text-xs text-destructive">{recollect.error}</p>
      ) : null}
      <RecollectPicker spotId={spot.id} recollect={recollect} />
    </li>
  );
}

function SpotSummary({ spot, compact = false }: { spot: Spot; compact?: boolean }) {
  return (
    <div className={compact ? "text-sm text-muted-foreground" : undefined}>
      <p className="font-medium text-foreground">
        <SpotPlaceName
          placeId={spot.placeId}
          fallback={spot.comment || "スポット"}
        />
      </p>
      {!compact && spot.comment ? (
        <p className="mt-1 text-sm text-muted-foreground">{spot.comment}</p>
      ) : null}
      {spot.savedCount > 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          輪で{spot.savedCount}人が保存
        </p>
      ) : null}
    </div>
  );
}

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const { spot, assertion, evidence, alternatives, savedByMe = false } =
    recommendation;
  const { place } = usePlace(spot.placeId);
  const recollect = useRecollect(spot.id, { initialSaved: savedByMe });

  const openNowText = openNowLabel(place?.openNow);

  return (
    <div className="mogu-elevated mt-2 w-full max-w-full rounded-xl border border-border p-mogu-screen-x py-3">
      {spot.photoUrls[0] ? (
        <AuthImage
          objectUrl={spot.photoUrls[0]}
          alt=""
          className="mb-3 aspect-[16/10] w-full rounded-lg object-cover"
        />
      ) : null}

      <p className="text-sm font-semibold leading-snug text-foreground">
        {assertion}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{evidence}</p>

      <div className="mt-3">
        <SpotSummary spot={spot} />
      </div>

      {openNowText ? (
        <p className="mt-2 text-xs font-medium text-primary">{openNowText}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={googleMapsPlaceUrl(spot.placeId)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-7 items-center justify-center rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted hover:text-foreground"
        >
          地図で開く
        </a>
        <Button
          variant="secondary"
          size="sm"
          disabled={recollect.busy}
          aria-pressed={recollect.saved}
          {...recollect.saveHandlers}
        >
          {recollect.saved ? "保存済み" : "リコレクション"}
        </Button>
      </div>

      {recollect.error ? (
        <p className="mt-2 text-xs text-destructive">{recollect.error}</p>
      ) : null}

      <GoogleMapsAttribution className="mt-2" />

      {alternatives.length > 0 ? (
        <details className="group mt-3 border-t border-border pt-3">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" />
            副候補（{alternatives.length}件）
          </summary>
          <ul className="mt-2 flex flex-col gap-3">
            {alternatives.map((alt) => (
              <AlternativeSpotRow key={alt.id} spot={alt} />
            ))}
          </ul>
        </details>
      ) : null}

      <RecollectPicker spotId={spot.id} recollect={recollect} />
    </div>
  );
}
