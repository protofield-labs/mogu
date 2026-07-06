/**
 * Browser API client unification verification (#110).
 * Run via: pnpm exec tsx scripts/verify-browser-client.ts
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { apiJson, apiJsonOrNull, apiVoid, parseApiJson } from "../src/lib/api/browser-client";
import { feedPageSchema } from "../src/lib/api/schemas/home";
import { spotSchema } from "../src/lib/api/schemas/spot";
import { toSpotDto } from "../src/lib/spot/to-spot-dto";
import type { SpotRow } from "../src/lib/spot/types";

const root = join(process.cwd(), "src");
const browserApiFiles = [
  "lib/home/browser-api.ts",
  "lib/mypage/browser-api.ts",
  "lib/spots/browser-api.ts",
  "lib/collections/browser-api.ts",
  "lib/agent/browser-api.ts",
  "lib/places/browser-api.ts",
  "lib/uploads/browser-api.ts",
  "lib/users/browser-api.ts",
];

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

assert(typeof apiJson === "function", "apiJson exported");
assert(typeof apiJsonOrNull === "function", "apiJsonOrNull exported");
assert(typeof apiVoid === "function", "apiVoid exported");
assert(typeof parseApiJson === "function", "parseApiJson exported");

const sampleSpot = spotSchema.parse(
  toSpotDto(
    {
      id: "11111111-1111-4111-8111-111111111111",
      placeId: "ChIJx",
      addedBy: "user-a",
      collectionId: "22222222-2222-4222-8222-222222222222",
      photoUrls: [],
      comment: "test",
      rating: "again",
      tagArea: "中目黒",
      tagGenre: "イタリアン",
      tagSituation: null,
      freeTags: [],
      originUserId: null,
      depth: 0,
      createdAt: new Date("2026-07-07T00:00:00.000Z"),
    } satisfies SpotRow,
    2,
  ),
);

assert(sampleSpot.structuredTags.area === "中目黒", "spot schema accepts DTO shape");

const feedSample = feedPageSchema.safeParse({
  items: [],
  nextCursor: null,
});
assert(feedSample.success, "feedPageSchema accepts empty page");

for (const file of browserApiFiles) {
  const source = readSource(file);
  assert(source.includes("@/lib/api/browser-client"), `${file} uses browser-client`);
  assert(!source.includes(") as "), `${file} must not cast JSON responses`);
}

const agentSource = readSource("lib/agent/browser-api.ts");
assert(
  agentSource.includes("readApiErrorResponse"),
  "agent SSE keeps readApiErrorResponse for stream errors",
);

const onboardingGate = readSource("components/onboarding-gate.tsx");
const onboardingPage = readSource("app/onboarding/page.tsx");
assert(
  onboardingGate.includes("@/lib/users/browser-api"),
  "onboarding gate uses users browser-api",
);
assert(
  onboardingPage.includes("@/lib/users/browser-api"),
  "onboarding page uses users browser-api",
);
assert(
  !onboardingGate.includes("authFetch"),
  "onboarding gate no longer calls authFetch directly",
);

const usersBrowserApi = readSource("lib/users/browser-api.ts");
assert(
  usersBrowserApi.includes('"/api/v1/me"'),
  "users browser-api uses /api/v1/me",
);

console.log("PASS: browser API client unification verified");
