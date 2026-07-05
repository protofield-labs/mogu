/**
 * Feed cursor + recommendation text helpers (#39/#42).
 * Run via: pnpm exec tsx scripts/verify-feed-helpers.ts
 */
import { Rating } from "@prisma/client";

import { decodeFeedCursor, encodeFeedCursor } from "../src/lib/feed/cursor";
import { buildAssertion, buildEvidence } from "../src/lib/recommendations/pick";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const createdAt = new Date("2026-07-06T12:00:00.000Z");
const id = "11111111-1111-4111-8111-111111111111";

assert(
  decodeFeedCursor(encodeFeedCursor(createdAt, id))?.id === id,
  "feed cursor round-trip",
);
assert(decodeFeedCursor("!!!") === null, "invalid feed cursor rejected");

assert(
  buildEvidence("Ken", Rating.again, 4).includes("輪で4人が保存"),
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
