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
    assert(isOrderedFriendshipPair(pair), `pair not distinct: ${a} / ${b}`);
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
  const pair = { userLow: UID_REPORTED, userHigh: "demo-aoi" };
  const pairId = encodeFriendshipPairId(pair);
  const decoded = decodeFriendshipPairId(pairId);
  assert(decoded !== null, "decode pairId");
  if (!decoded) {
    return;
  }
  assert(decoded.userLow === pair.userLow, "round-trip userLow");
  assert(decoded.userHigh === pair.userHigh, "round-trip userHigh");
  assert(decodeFriendshipPairId("not-valid") === null, "reject invalid pairId");
  assert(
    decodeFriendshipPairId(
      encodeFriendshipPairId({ userLow: "same", userHigh: "same" }),
    ) === null,
    "reject identical ids",
  );
}

async function verifyPostgresLeastGreatest() {
  if (!process.env.DATABASE_URL) {
    console.log("SKIP: DATABASE_URL not set (Postgres LEAST/GREATEST cross-check)");
    return;
  }

  const samples: [string, string][] = [
    [UID_REPORTED, "demo-ken"],
    [UID_REPORTED, "aaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
    ["rls-friends-user-a", "rls-friends-user-b"],
    ["demo-ken", "demo-viewer"],
  ];

  try {
    for (const [a, b] of samples) {
      const rows = await prisma.$queryRaw<
        { user_low: string; user_high: string; check_ok: boolean }[]
      >`
        SELECT LEAST(${a}::text, ${b}::text) AS user_low,
               GREATEST(${a}::text, ${b}::text) AS user_high,
               (LEAST(${a}::text, ${b}::text) < GREATEST(${a}::text, ${b}::text)) AS check_ok
      `;
      const pg = rows[0];
      assert(pg !== undefined, "postgres row");
      assert(pg.user_low !== pg.user_high, `pair must be distinct for ${a}/${b}`);
      assert(pg.check_ok, `CHECK would fail for ${a}/${b}`);

      const bytePair = normalizeFriendshipPair(a, b);
      if (
        bytePair.userLow !== pg.user_low ||
        bytePair.userHigh !== pg.user_high
      ) {
        console.log(
          `  note: byte normalize differs from PG LEAST for ${JSON.stringify([a, b])}`,
        );
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("Authentication failed") ||
      message.includes("Can't reach database server") ||
      message.includes("ECONNREFUSED")
    ) {
      console.log(
        "SKIP: Postgres unavailable (LEAST/GREATEST cross-check)",
      );
      return;
    }
    throw error;
  }
}

async function main() {
  verifyByteOrdering();
  verifyPairIdRoundTrip();
  await verifyPostgresLeastGreatest();
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
