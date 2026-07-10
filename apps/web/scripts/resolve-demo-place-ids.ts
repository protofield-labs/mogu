/**
 * Resolve demo seed place_id values via Places API Text Search (#317).
 * Run via: PLACES_API_KEY=... pnpm exec tsx scripts/resolve-demo-place-ids.ts
 */
const PLACES_BASE = "https://places.googleapis.com/v1";

const QUERIES = {
  sharedIzakaya: "大衆SAKEBAR るぺーる 中目黒",
  kenNakaCounter: "酒とつまみ じょうご 中目黒",
  kenEbisuStanding: "立ち飲み 恵比寿 駅",
  kenOfficeBistro: "Bistro Bonne Nouvelle 恵比寿",
  aoiNakaWine: "中目黒 ワインバー 静か",
  aoiEbisuDate: "恵比寿 フレンチ デート",
  aoiAnniversary: "ES Classico 恵比寿",
} as const;

type SearchResult = { placeId: string; name: string; address: string };

function readApiKey(): string {
  const key = process.env.PLACES_API_KEY?.trim();
  if (!key) {
    throw new Error("PLACES_API_KEY is not configured");
  }
  return key;
}

async function searchPlaces(query: string): Promise<SearchResult[]> {
  const response = await fetch(`${PLACES_BASE}/places:searchText?languageCode=ja`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": readApiKey(),
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
    },
    body: JSON.stringify({
      textQuery: query,
      pageSize: 10,
      languageCode: "ja",
      regionCode: "JP",
    }),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  const data = (await response.json()) as {
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
    }>;
  };
  return (data.places ?? [])
    .map((place) => {
      const placeId = place.id?.replace(/^places\//, "") ?? "";
      const name = place.displayName?.text?.trim() ?? "";
      if (!placeId || !name) {
        return null;
      }
      return {
        placeId,
        name,
        address: place.formattedAddress ?? "",
      };
    })
    .filter((item): item is SearchResult => item !== null);
}

async function fetchPlaceDetails(placeId: string): Promise<boolean> {
  const response = await fetch(
    `${PLACES_BASE}/places/${encodeURIComponent(placeId)}?languageCode=ja`,
    {
      headers: {
        "X-Goog-Api-Key": readApiKey(),
        "X-Goog-FieldMask": "id,displayName,photos,currentOpeningHours",
      },
    },
  );
  return response.ok;
}

async function pickFirst(
  key: keyof typeof QUERIES,
  areaHint: string,
): Promise<string> {
  const query = QUERIES[key];
  const results = await searchPlaces(query);
  if (results.length === 0) {
    throw new Error(`No results for: ${query}`);
  }
  for (const candidate of results) {
    if (!candidate.address.includes(areaHint)) {
      continue;
    }
    const ok = await fetchPlaceDetails(candidate.placeId);
    if (!ok) {
      continue;
    }
    console.log(`  ${key}: ${query}`);
    console.log(`    → ${candidate.name} (${candidate.placeId})`);
    console.log(`      ${candidate.address}`);
    return candidate.placeId;
  }
  throw new Error(
    `No resolvable place in ${areaHint} for ${key}: ${query}`,
  );
}

async function main() {
  console.log("Resolving demo place IDs…");
  const ids: Record<keyof typeof QUERIES, string> = {
    sharedIzakaya: await pickFirst("sharedIzakaya", "目黒"),
    kenNakaCounter: await pickFirst("kenNakaCounter", "目黒"),
    kenEbisuStanding: await pickFirst("kenEbisuStanding", "渋谷"),
    kenOfficeBistro: await pickFirst("kenOfficeBistro", "渋谷"),
    aoiNakaWine: await pickFirst("aoiNakaWine", "目黒"),
    aoiEbisuDate: await pickFirst("aoiEbisuDate", "渋谷"),
    aoiAnniversary: await pickFirst("aoiAnniversary", "渋谷"),
  };

  console.log("\nResolved IDs:");
  console.log(JSON.stringify(ids, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
