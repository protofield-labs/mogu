"use client";

import { SpotThumbnail } from "@/components/places/spot-thumbnail";
import { SpotPlaceName } from "@/components/places/spot-place-name";
import { useAgentChatContext } from "@/components/search/agent-chat-context";
import type { Spot } from "@/lib/agent/types";
import { usePlace } from "@/lib/places/use-place";
import { touchCardClass } from "@/lib/ui/touch-feedback";
import { cn } from "@/lib/utils";

function CandidateSpotCard({
  spot,
  disabled,
  onSelect,
}: {
  spot: Spot;
  disabled: boolean;
  onSelect: (spot: Spot) => void;
}) {
  const { place, placeName, loading } = usePlace(spot.placeId);
  const tagLine = [spot.structuredTags.area, spot.structuredTags.genre]
    .filter(Boolean)
    .join(" / ");

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(spot)}
      className={cn(
        "mogu-elevated w-40 shrink-0 snap-start rounded-2xl p-2 text-left transition-colors hover:bg-muted/40 disabled:opacity-60",
        touchCardClass,
      )}
      aria-label={`${placeName || spot.comment || "候補のお店"}について詳しく聞く`}
    >
      <SpotThumbnail
        spot={spot}
        place={place}
        placeLoading={loading}
        showMapsAttribution
        className="aspect-[4/3] w-full overflow-hidden rounded-xl object-cover"
      />
      <span className="mt-2 block truncate text-sm font-medium text-foreground">
        <SpotPlaceName
          placeId={spot.placeId}
          fallback={spot.comment || "スポット"}
          placeName={placeName}
          loading={loading}
        />
      </span>
      {tagLine ? (
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {tagLine}
        </span>
      ) : null}
      <span className="mt-1 block text-xs font-medium text-primary">
        この店について詳しく
      </span>
    </button>
  );
}

/** Candidate spot cards under a consult reply; tap pins the follow-up (#287). */
export function AgentCandidateSpotCards({ spots }: { spots: Spot[] }) {
  const { state, actions } = useAgentChatContext();

  if (spots.length === 0) {
    return null;
  }

  return (
    <div
      role="group"
      aria-label="候補のお店"
      className="mt-2 flex w-full max-w-full snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {spots.map((spot) => (
        <CandidateSpotCard
          key={spot.id}
          spot={spot}
          disabled={state.inputDisabled}
          onSelect={actions.sendCandidateFollowUp}
        />
      ))}
    </div>
  );
}
