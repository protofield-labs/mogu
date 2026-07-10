import "server-only";

import { withAuthRls } from "@/lib/auth/with-auth-rls";
import {
  DEMO_COLLECTION_IDS,
  DEMO_PERSONAS,
} from "@/lib/seed/demo-data";
import { DEMO_PERSONA_VIEWER_UID } from "./demo-persona-spots";
import type { PersonaCollectionBlock } from "./persona-collection-message";
import { hasPersonaCollectionSpots } from "./persona-collection-message";

const PERSONA_BLOCKS: Array<{
  personaKey: "ken" | "aoi";
  displayName: string;
  collectionName: string;
  tags: string;
  ownerId: string;
  collectionId: string;
}> = [
  {
    personaKey: "ken",
    displayName: "Ken",
    collectionName: "中目黒サク飲み",
    tags: "居酒屋 / コスパ / 友人",
    ownerId: DEMO_PERSONAS.ken.uid,
    collectionId: DEMO_COLLECTION_IDS.kenIzakaya,
  },
  {
    personaKey: "aoi",
    displayName: "Aoi",
    collectionName: "静かな二人時間",
    tags: "デート / 雰囲気 / 記念日",
    ownerId: DEMO_PERSONAS.aoi.uid,
    collectionId: DEMO_COLLECTION_IDS.aoiQuiet,
  },
];

async function loadPersonaCollectionBlocksForUid(
  viewerUid: string,
): Promise<PersonaCollectionBlock[]> {
  return withAuthRls(viewerUid, async (tx) => {
    const blocks: PersonaCollectionBlock[] = [];

    for (const def of PERSONA_BLOCKS) {
      const spots = await tx.spot.findMany({
        where: {
          addedBy: def.ownerId,
          collectionId: def.collectionId,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 6,
        select: {
          id: true,
          placeId: true,
          tagArea: true,
          tagGenre: true,
          tagSituation: true,
          comment: true,
          rating: true,
        },
      });

      blocks.push({
        personaKey: def.personaKey,
        displayName: def.displayName,
        collectionName: def.collectionName,
        tags: def.tags,
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

/**
 * Load Ken/Aoi demo collection spots visible to the viewer (RLS) (#264).
 * Falls back to demo-viewer friendships when the signed-in user is not linked
 * to demo personas (typical on shared dev — #317).
 */
export async function loadPersonaCollectionBlocks(
  viewerUid: string,
): Promise<PersonaCollectionBlock[]> {
  const viewerBlocks = await loadPersonaCollectionBlocksForUid(viewerUid);
  if (hasPersonaCollectionSpots(viewerBlocks)) {
    return viewerBlocks;
  }
  if (viewerUid === DEMO_PERSONA_VIEWER_UID) {
    return viewerBlocks;
  }
  return loadPersonaCollectionBlocksForUid(DEMO_PERSONA_VIEWER_UID);
}
