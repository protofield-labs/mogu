import "server-only";

import { withAuthRls } from "@/lib/auth/with-auth-rls";
import { AGENT_PERSONAS } from "@/lib/agent/persona-config";
import { withDemoPersonaViewerFallback } from "./demo-persona-fallback";
import type { PersonaCollectionBlock } from "./persona-collection-message";
import { hasPersonaCollectionSpots } from "./persona-collection-message";
import { isPersonaCoreSpotId } from "./persona-config";

async function loadPersonaCollectionBlocksForUid(
  viewerUid: string,
): Promise<PersonaCollectionBlock[]> {
  return withAuthRls(viewerUid, async (tx) => {
    const blocks: PersonaCollectionBlock[] = [];

    for (const persona of AGENT_PERSONAS) {
      const rows = await tx.spot.findMany({
        where: {
          addedBy: persona.ownerId,
          collectionId: persona.collectionId,
          archivedAt: null,
        },
        select: {
          id: true,
          placeId: true,
          tagArea: true,
          tagGenre: true,
          tagSituation: true,
          comment: true,
          rating: true,
          createdAt: true,
        },
      });
      const spots = sortPersonaPrefetchSpots(rows).slice(0, 6);

      blocks.push({
        personaKey: persona.key,
        displayName: persona.displayName,
        collectionName: persona.collectionName,
        tags: persona.tagsSlash,
        spots: spots.map((spot) => ({
          placeId: spot.placeId,
          spotId: spot.id,
          tagArea: spot.tagArea,
          tagGenre: spot.tagGenre,
          tagSituation: spot.tagSituation,
          comment: spot.comment,
          rating: spot.rating,
        })),
      });
    }

    return blocks;
  });
}

function sortPersonaPrefetchSpots<T extends { id: string; createdAt: Date }>(
  spots: T[],
): T[] {
  return [...spots].sort((left, right) => {
    const leftCore = isPersonaCoreSpotId(left.id) ? 1 : 0;
    const rightCore = isPersonaCoreSpotId(right.id) ? 1 : 0;
    if (leftCore !== rightCore) {
      return rightCore - leftCore;
    }
    const createdDiff = right.createdAt.getTime() - left.createdAt.getTime();
    if (createdDiff !== 0) {
      return createdDiff;
    }
    return right.id.localeCompare(left.id);
  });
}

/**
 * Load Ken/Aoi demo collection spots visible to the viewer (RLS) (#264).
 * Falls back to demo-viewer friendships when demo mode is enabled and the
 * signed-in user is not linked to demo personas (#317 / #334).
 */
export async function loadPersonaCollectionBlocks(
  viewerUid: string,
): Promise<PersonaCollectionBlock[]> {
  return withDemoPersonaViewerFallback(
    viewerUid,
    loadPersonaCollectionBlocksForUid,
    (blocks) => !hasPersonaCollectionSpots(blocks),
  );
}
