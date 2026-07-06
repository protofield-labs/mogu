/**
 * Run all RLS verify scripts (#114).
 * Requires DATABASE_URL (app_user, not superuser).
 */
import { spawnSync } from "node:child_process";

const scripts = [
  "verify-core-schema.ts",
  "verify-users-rls.ts",
  "verify-recollect-rls.ts",
  "verify-saved-count.ts",
  "verify-flags-rls.ts",
  "verify-spots-rls.ts",
  "verify-feed-rls.ts",
  "verify-recommendations-rls.ts",
  "verify-friends-rls.ts",
];

for (const script of scripts) {
  console.log(`==> ${script}`);
  const result = spawnSync("pnpm", ["exec", "tsx", `scripts/${script}`], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("PASS: all RLS verify scripts completed");
