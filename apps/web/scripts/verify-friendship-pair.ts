/**
 * Friendship pair ordering verification (#79).
 * Run via: pnpm exec tsx scripts/verify-friendship-pair.ts
 */
import { PrismaClient } from "@prisma/client";

import {
  compareFriendshipUids,
  decodeFriendshipPairId,
  encodeFriendshipPairId,
  isOrderedFriendshipPair,
  normalizeFriendshipPair,
} from "../src/lib/friendship/pair";

const prisma = new PrismaClient();

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const UID_REPORTED = "GBguwTEai5c8DPCdbQEVu6VOXRI3";

function verifyByteOrdering() {
  const pairs: [string, string][] = [
    [UID_REPORTED, "demo-ken"],
    [UID_REPORTED, "ZZZZZZZZZZZZZZZZZZZZZZZZZZZZ"],
    ["aaa", "aab"],
    ["demo-ken", "demo-viewer"],
    ["rls-friends-user-a", "rls-friends-user-b"],
  ];

  for (const [a, b] of pairs) {
    const pair = normalizeFriendshipPair(a, b);
    assert(isOrderedFriendshipPair(pair), `pair not ordered: ${a} / ${b}`);
    assert(
      compareFriendshipUids(pair.userLow, pair.userHigh) < 0,
      `byte order failed: ${a} / ${b}`,
    );

    const jsPair =
      a < b ? { userLow: a, userHigh: b } : { userLow: b, userHigh: a };
    if (
      jsPair.userLow !== pair.userLow ||
      jsPair.userHigh !== pair.userHigh
    ) {
      console.log(
        `  note: JS < differs from byte order for ${JSON.stringify([a, b])}`,
      );
    }
  }
}

function verifyPairIdRoundTrip() {
  const pair = normalizeFriendshipPair(UID_REPORTED, "demo-aoi");
  const pairId = encodeFriendshipPairId(pair);
  const decoded = decodeFriendshipPairId(pairId);
  assert(decoded !== null, "decode pairId");
  if (!decoded) {
    return;
  }
  assert(decoded.userLow === pair.userLow, "round-trip userLow");
  assert(decoded.userHigh === pair.userHigh, "round-trip userHigh");
  assert(decodeFriendshipPairId("not-valid") === null, "reject invalid pairId");
}

async function verifyMatchesPostgresLeastGreatest() {
  if (!process.env.DATABASE_URL) {
    console.log("SKIP: DATABASE_URL not set (Postgres LEAST/GREATEST cross-check)");
    return;
  }

  const samples: [string, string][] = [
    [UID_REPORTED, "demo-ken"],
    [UID_REPORTED, "aaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
    ["rls-friends-user-a", "rls-friends-user-b"],
  ];

  for (const [a, b] of samples) {
    const rows = await prisma.$queryRaw<
      { user_low: string; user_high: string }[]
    >`
      SELECT LEAST(${a}::text, ${b}::text) AS user_low,
             GREATEST(${a}::text, ${b}::text) AS user_high
    `;
    const pg = rows[0];
    const normalized = normalizeFriendshipPair(a, b);
    assert(pg !== undefined, "postgres row");
    assert(
      pg.user_low === normalized.userLow,
      `user_low mismatch for ${a}/${b}: pg=${pg.user_low} js=${normalized.userLow}`,
    );
    assert(
      pg.user_high === normalized.userHigh,
      `user_high mismatch for ${a}/${b}`,
    );
  }
}

async function main() {
  verifyByteOrdering();
  verifyPairIdRoundTrip();
  await verifyMatchesPostgresLeastGreatest();
  console.log("PASS: friendship pair verification");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
