/**
 * Feed cursor + recommendation text helpers (#39/#42).
 * Run via: pnpm exec tsx scripts/verify-feed-helpers.ts
 */
import { assert } from "./test-helpers/assert";

import { Rating } from "@prisma/client";

import { decodeFeedCursor, encodeFeedCursor } from "../src/lib/feed/cursor";
import { buildAssertion, buildEvidence } from "../src/lib/recommendations/pick";
import { jstTodayDate } from "../src/lib/recommendations/valid-date";

const createdAt = new Date("2026-07-06T12:00:00.000Z");
const id = "11111111-1111-4111-8111-111111111111";

assert(
  decodeFeedCursor(encodeFeedCursor(createdAt, id))?.id === id,
  "feed cursor round-trip",
);
assert(decodeFeedCursor("!!!") === null, "invalid feed cursor rejected");
assert(
  decodeFeedCursor(encodeFeedCursor(createdAt, "not-a-uuid")) === null,
  "non-UUID cursor id rejected",
);

// JST calendar day: 2026-07-06T20:00Z is already 07-07 05:00 in JST.
assert(
  jstTodayDate(new Date("2026-07-06T20:00:00.000Z"))
    .toISOString()
    .startsWith("2026-07-07"),
  "jstTodayDate rolls over at JST midnight",
);
assert(
  jstTodayDate(new Date("2026-07-06T10:00:00.000Z"))
    .toISOString()
    .startsWith("2026-07-06"),
  "jstTodayDate keeps same day before JST midnight",
);

assert(
  buildEvidence("Ken", Rating.again, 4).includes("グループで4人が保存"),
  "evidence includes savedCount",
);
assert(
  buildAssertion({
    id,
    placeId: "ChIJx",
    addedBy: "ken",
    rating: Rating.again,
    tagArea: "中目黒",
    tagGenre: "イタリアン",
    addedByUser: { displayName: "Ken" },
  }).includes("中目黒"),
  "assertion uses structured tags",
);

console.log("PASS: feed/recommendation helpers verified");
