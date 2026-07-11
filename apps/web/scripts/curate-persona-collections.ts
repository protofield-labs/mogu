/**
 * Weekly persona collection curation (#318).
 * Run via: DATABASE_URL=... PLACES_API_KEY=... pnpm exec tsx scripts/curate-persona-collections.ts
 */
import { installServerOnlyMock } from "./test-helpers/mock-server-only";

installServerOnlyMock();

import { randomUUID } from "node:crypto";

import { PrismaClient, Rating } from "@prisma/client";

import {
  AGENT_PERSONAS,
  type AgentPersonaConfig,
} from "../src/lib/agent/persona-config";
import {
  buildPersonaSearchQuery,
  isRotatablePersonaSpot,
  PERSONA_CURATION_MAX_ACTIVE_SPOTS,
  PERSONA_CURATION_WEEKLY_ADD_LIMIT,
  type PersonaSpotRow,
} from "../src/lib/persona-curation/queries";
import { withSeedRls } from "../src/lib/seed/rls";

async function loadPlacesClient() {
  return import("../src/lib/places/google-places-client");
}

const prisma = new PrismaClient();

async function loadActivePersonaSpots(
  persona: AgentPersonaConfig,
): Promise<PersonaSpotRow[]> {
  return withSeedRls(prisma, persona.ownerId, (scoped) =>
    scoped.spot.findMany({
      where: {
        collectionId: persona.collectionId,
        addedBy: persona.ownerId,
        archivedAt: null,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        placeId: true,
        tagArea: true,
        tagGenre: true,
        tagSituation: true,
        comment: true,
        createdAt: true,
      },
    }),
  );
}

async function archiveSpot(spotId: string): Promise<void> {
  await prisma.$executeRaw`
    SELECT archive_persona_spot(${spotId}::uuid)
  `;
}

async function insertCuratedSpot(
  persona: AgentPersonaConfig,
  placeId: string,
  tags: Pick<PersonaSpotRow, "tagArea" | "tagGenre" | "tagSituation">,
  name: string,
): Promise<boolean> {
  const spotId = randomUUID();
  await prisma.$executeRaw`
    SELECT insert_persona_curation_spot(
      ${spotId}::uuid,
      ${placeId},
      ${persona.ownerId},
      ${persona.collectionId}::uuid,
      ${`${name} — 週次 curation で追加`},
      ${Rating.either}::rating,
      ${tags.tagArea},
      ${tags.tagGenre},
      ${tags.tagSituation},
      ${["curation"]}::text[]
    )
  `;
  return true;
}

async function curatePersonaCollection(persona: AgentPersonaConfig): Promise<{
  archived: number;
  added: number;
}> {
  const {
    fetchPlaceBusinessStatus,
    searchPlaces,
  } = await loadPlacesClient();

  let archived = 0;
  let added = 0;

  const spots = await loadActivePersonaSpots(persona);

  for (const spot of spots) {
    if (!isRotatablePersonaSpot(spot.id)) {
      continue;
    }
    const status = await fetchPlaceBusinessStatus(spot.placeId);
    if (status !== "CLOSED_TEMPORARILY" && status !== "CLOSED_PERMANENTLY") {
      continue;
    }
    await archiveSpot(spot.id);
    archived += 1;
  }

  const refreshed = await loadActivePersonaSpots(persona);
  if (refreshed.length >= PERSONA_CURATION_MAX_ACTIVE_SPOTS) {
    return { archived, added };
  }

  const knownPlaceIds = new Set(refreshed.map((spot) => spot.placeId));
  const sampleSpot = refreshed[0];
  const query = buildPersonaSearchQuery(persona, sampleSpot);
  const candidates = await searchPlaces(`${query} 東京`);

  for (const candidate of candidates) {
    if (added >= PERSONA_CURATION_WEEKLY_ADD_LIMIT) {
      break;
    }
    if (knownPlaceIds.has(candidate.placeId)) {
      continue;
    }
    const status = await fetchPlaceBusinessStatus(candidate.placeId);
    if (status !== "OPERATIONAL" && status !== "UNKNOWN") {
      continue;
    }

    const inserted = await insertCuratedSpot(
      persona,
      candidate.placeId,
      {
        tagArea: sampleSpot?.tagArea ?? "中目黒",
        tagGenre: sampleSpot?.tagGenre ?? persona.tagsSlash.split("/")[0]?.trim() ?? null,
        tagSituation:
          sampleSpot?.tagSituation ?? persona.tagsSlash.split("/")[1]?.trim() ?? null,
      },
      candidate.name,
    );
    if (inserted) {
      knownPlaceIds.add(candidate.placeId);
      added += 1;
    }
  }

  return { archived, added };
}

async function main() {
  let archivedTotal = 0;
  let addedTotal = 0;

  for (const persona of AGENT_PERSONAS) {
    const result = await curatePersonaCollection(persona);
    archivedTotal += result.archived;
    addedTotal += result.added;
    console.log(
      `persona=${persona.key} archived=${result.archived} added=${result.added}`,
    );
  }

  console.log(
    `PASS: persona collection curation (archived=${archivedTotal}, added=${addedTotal})`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
