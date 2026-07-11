/**
 * Demo seed DB policy hardening verification (#331).
 * Run via: DATABASE_URL=... pnpm exec tsx scripts/verify-demo-seed-policy.ts
 */
import { PrismaClient } from "@prisma/client";

import { assert } from "./test-helpers/assert";
import { runVerifyScript } from "./test-helpers/rls-harness";

const prisma = new PrismaClient();

const DELETE_SEED_POLICIES: { table: string; policy: string; mustInclude: string }[] =
  [
    {
      table: "daily_recommendations",
      policy: "daily_reco_delete_seed",
      mustInclude: "demo-%",
    },
    {
      table: "flags",
      policy: "flags_delete_seed",
      mustInclude: "demo-%",
    },
    {
      table: "recollection_edges",
      policy: "recollection_delete_seed",
      mustInclude: "44444444-4444-4444-8444-444444444401",
    },
    {
      table: "spots",
      policy: "spots_delete_seed",
      mustInclude: "22222222-2222-4222-8222-%",
    },
    {
      table: "collections",
      policy: "collections_delete_seed",
      mustInclude: "11111111-1111-4111-8111-%",
    },
    {
      table: "friendships",
      policy: "friendships_delete_seed",
      mustInclude: "demo-%",
    },
    {
      table: "spot_likes",
      policy: "spot_likes_delete_seed",
      mustInclude: "22222222-2222-4222-8222-%",
    },
  ];

async function main() {
  const wipeFn = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*) AS count
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'demo_seed_wipe'
  `;
  assert(
    Number(wipeFn[0]?.count ?? 0) === 0,
    "demo_seed_wipe function must not exist in production schema",
  );

  for (const { table, policy, mustInclude } of DELETE_SEED_POLICIES) {
    const rows = await prisma.$queryRaw<{ qual: string | null }[]>`
      SELECT qual::text AS qual
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = ${table}
        AND policyname = ${policy}
    `;
    assert(rows.length === 1, `${policy} exists on ${table}`);
    const qual = rows[0]?.qual ?? "";
    assert(
      qual.includes(mustInclude),
      `${policy} is scoped to demo rows (${mustInclude})`,
    );
    assert(
      qual.includes("app.demo_seed"),
      `${policy} still requires demo_seed session flag`,
    );
  }

  console.log("PASS: demo seed policy hardening (#331)");
}

runVerifyScript(main);
