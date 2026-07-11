/**
 * Persona curation pipeline verification (#318).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { assert } from "./test-helpers/assert";
import { installServerOnlyMock } from "./test-helpers/mock-server-only";

installServerOnlyMock();

import {
  AGENT_PERSONAS,
  isPersonaCoreSpotId,
  PERSONA_CORE_SPOT_IDS,
} from "../src/lib/agent/persona-config";
import {
  buildPersonaSearchQuery,
  isRotatablePersonaSpot,
  PERSONA_CURATION_WEEKLY_ADD_LIMIT,
} from "../src/lib/persona-curation/queries";

const root = process.cwd();

const migration = readFileSync(
  join(root, "prisma/migrations/20260711150000_spot_archive_curation/migration.sql"),
  "utf8",
);
assert(migration.includes("archived_at"), "spot archive migration adds archived_at");
assert(
  migration.includes("archive_persona_spot"),
  "spot archive migration defines archive_persona_spot",
);
assert(
  migration.includes("REVOKE ALL ON FUNCTION archive_persona_spot"),
  "archive_persona_spot revokes public execute",
);
assert(
  migration.includes("demo-ken"),
  "curation functions scope to demo personas",
);

assert(
  AGENT_PERSONAS.every((persona) => PERSONA_CORE_SPOT_IDS[persona.key]),
  "each persona has a core spot id",
);
assert(isPersonaCoreSpotId(PERSONA_CORE_SPOT_IDS.ken), "ken core spot is marked core");
assert(
  !isRotatablePersonaSpot(PERSONA_CORE_SPOT_IDS.ken),
  "core spot is not rotatable",
);

const kenQuery = buildPersonaSearchQuery(AGENT_PERSONAS[0]!, {
  id: PERSONA_CORE_SPOT_IDS.ken,
  placeId: "ChIJtest",
  tagArea: "中目黒",
  tagGenre: "居酒屋",
  tagSituation: "サク飲み",
  comment: "",
  createdAt: new Date(),
});
assert(kenQuery.includes("中目黒"), "persona search query includes area");
assert(kenQuery.includes("居酒屋"), "persona search query includes genre");

const placesClient = readFileSync(
  join(root, "src/lib/places/google-places-client.ts"),
  "utf8",
);
assert(
  placesClient.includes("fetchPlaceBusinessStatus"),
  "google places client exposes fetchPlaceBusinessStatus",
);
assert(
  placesClient.includes("isClosedBusinessStatus"),
  "google places client exposes isClosedBusinessStatus",
);

const personaContext = readFileSync(
  join(root, "src/lib/agent/persona-collection-context.ts"),
  "utf8",
);
assert(
  personaContext.includes("archivedAt: null"),
  "prefetch excludes archived spots",
);
assert(
  personaContext.includes("sortPersonaPrefetchSpots"),
  "prefetch sorts core spots first",
);

const jobTf = readFileSync(
  join(root, "../../terraform/environments/dev/persona_curation_job.tf"),
  "utf8",
);
assert(
  jobTf.includes("curate-persona-collections.ts"),
  "terraform job runs curation script",
);

const schedulerTf = readFileSync(
  join(root, "../../terraform/environments/dev/persona_curation_scheduler.tf"),
  "utf8",
);
assert(schedulerTf.includes("0 5 * * 1"), "scheduler runs weekly on Monday");

assert(
  PERSONA_CURATION_WEEKLY_ADD_LIMIT === 1,
  "weekly add limit defaults to one spot per persona",
);

console.log("PASS: verify-persona-curation");
