"use client";

import { useAgentChatContext } from "@/components/search/agent-chat-context";
import { SpotListRow } from "@/components/spots/spot-list-row";
import type { Spot } from "@/lib/agent/types";

function candidateTagLine(spot: Spot): string | undefined {
  const line = [spot.structuredTags.area, spot.structuredTags.genre]
    .filter(Boolean)
    .join(" / ");
  return line || undefined;
}

/** Candidate spot rows under a consult reply; tap pins the follow-up (#287 / #314). */
export function AgentCandidateSpotCards({ spots }: { spots: Spot[] }) {
  const { state, actions } = useAgentChatContext();

  if (spots.length === 0) {
    return null;
  }

  return (
    <ul
      role="group"
      aria-label="候補のお店"
      className="mt-2 flex w-full max-w-full flex-col gap-2"
    >
      {spots.map((spot) => (
        <li key={spot.id}>
          <SpotListRow
            spot={spot}
            disabled={state.inputDisabled}
            onSelect={() => actions.sendCandidateFollowUp(spot)}
            distanceLabel={candidateTagLine(spot)}
            showComment={false}
            actionLabel="この店について詳しく"
          />
        </li>
      ))}
    </ul>
  );
}
