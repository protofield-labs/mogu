/**
 * SpotDto unification + depth>=2 originUserId mask (#109).
 * Run via: pnpm exec tsx scripts/verify-spot-dto.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { toSpotDto } from "../src/lib/spot/to-spot-dto";
import type { SpotRow } from "../src/lib/spot/types";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function baseSpotRow(overrides: Partial<SpotRow> = {}): SpotRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    placeId: "ChIJx",
    addedBy: "user-a",
    collectionId: "22222222-2222-4222-8222-222222222222",
    photoUrls: [],
    comment: "test",
    rating: "again",
    tagArea: "中目黒",
    tagGenre: "イタリアン",
    tagSituation: "デート",
    freeTags: [],
    originUserId: "origin-user",
    depth: 0,
    createdAt: new Date("2026-07-07T00:00:00.000Z"),
    ...overrides,
  };
}

const depth0 = toSpotDto(baseSpotRow({ depth: 0 }), 3);
assert(
  depth0.originUserId === "origin-user",
  "depth 0 preserves originUserId",
);

const depth1 = toSpotDto(baseSpotRow({ depth: 1 }), 3);
assert(
  depth1.originUserId === "origin-user",
  "depth 1 preserves originUserId",
);

const depth2 = toSpotDto(baseSpotRow({ depth: 2 }), 3);
assert(depth2.originUserId === null, "depth >= 2 masks originUserId");

const collectionsSource = readSource("lib/dal/collections.ts");
assert(
  !collectionsSource.includes("function toSpotDto"),
  "collections.ts must not define local toSpotDto",
);
assert(
  !/export type SpotDto = \{/.test(collectionsSource),
  "collections.ts must not redefine SpotDto",
);

const spotsSource = readSource("lib/dal/spots.ts");
assert(
  !spotsSource.includes("function toSpotDto"),
  "spots.ts must not define local toSpotDto",
);
assert(
  !/export type SpotDto = \{/.test(spotsSource),
  "spots.ts must not redefine SpotDto",
);

const agentTypesSource = readSource("lib/agent/types.ts");
assert(
  !agentTypesSource.includes("Record<string, unknown>"),
  "agent Spot must not use loose structuredTags",
);
assert(
  agentTypesSource.includes('from "@/lib/spot/types"'),
  "agent Spot derives from shared spot types",
);

const browserApiSource = readSource("lib/spots/browser-api.ts");
assert(
  browserApiSource.includes("export type Spot = SpotDto"),
  "browser Spot aliases SpotDto",
);

console.log("PASS: spot-dto unification verified");
