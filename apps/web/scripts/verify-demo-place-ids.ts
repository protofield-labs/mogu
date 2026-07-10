/**
 * Demo seed place_id verification (#317).
 * Run via: pnpm exec tsx scripts/verify-demo-place-ids.ts
 * Optional: PLACES_API_KEY=... to assert Places Details resolve with photos.
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  DEMO_PLACE_IDS,
  DEMO_PLACE_ID_VALUES,
  DEMO_SHARED_PLACE_ID,
} from "../src/lib/seed/demo-place-ids";

const PLACES_BASE = "https://places.googleapis.com/v1";

function readSeedSource(): string {
  return readFileSync(
    join(process.cwd(), "src/lib/seed/run-demo-seed.ts"),
    "utf8",
  );
}

async function assertPlaceResolvable(placeId: string): Promise<void> {
  const key = process.env.PLACES_API_KEY?.trim();
  if (!key) {
    return;
  }
  const response = await fetch(
    `${PLACES_BASE}/places/${encodeURIComponent(placeId)}?languageCode=ja`,
    {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "id,displayName,photos",
      },
    },
  );
  assert(response.ok, `Places API resolves ${placeId}`);
  const place = (await response.json()) as { photos?: unknown[] };
  assert(
    Array.isArray(place.photos) && place.photos.length > 0,
    `place has photos: ${placeId}`,
  );
}

async function main() {
  const seed = readSeedSource();
  assert(!seed.includes("ChIJseed"), "demo seed no longer uses fake place_id");
  assert(
    seed.includes("DEMO_PLACE_IDS"),
    "demo seed imports shared demo place ids",
  );

  assert(
    DEMO_SHARED_PLACE_ID === DEMO_PLACE_IDS.sharedNakameguro,
    "shared place id alias",
  );
  assert(
    new Set(DEMO_PLACE_ID_VALUES).size === DEMO_PLACE_ID_VALUES.length,
    "demo place ids are unique",
  );

  for (const placeId of DEMO_PLACE_ID_VALUES) {
    assert(placeId.startsWith("ChIJ"), `real-looking place id: ${placeId}`);
    assert(!placeId.includes("seed"), `no fake seed prefix: ${placeId}`);
  }

  if (process.env.PLACES_API_KEY?.trim()) {
    for (const placeId of DEMO_PLACE_ID_VALUES) {
      await assertPlaceResolvable(placeId);
    }
  }

  console.log("PASS: demo place ids verified");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
