/**
 * Dead code cleanup verification (#115).
 * Run via: pnpm exec tsx scripts/verify-dead-code.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { assert } from "./test-helpers/assert";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

assert(
  !readSource("lib/dal/users.ts").includes("getUserByUid"),
  "getUserByUid removed from DAL",
);
assert(
  readSource("lib/auth/provision.ts").includes("userSchema.parse"),
  "provision client validates flat User with userSchema",
);
assert(
  !readSource("lib/auth/provision.ts").includes("as ProvisionUser"),
  "provision client must not cast response",
);
assert(
  readSource("lib/users/types.ts").includes("export type UserProfile"),
  "UserProfile type centralized in lib/users/types",
);
assert(
  readSource("lib/users/types.ts").includes("export type MeProfile"),
  "MeProfile type centralized in lib/users/types",
);
assert(
  readSource("lib/users/browser-api.ts").includes("@/lib/users/types"),
  "users browser-api imports shared user types",
);
assert(
  readSource("lib/mypage/types.ts").includes("@/lib/users/types"),
  "mypage types re-export MeProfile from users/types",
);
assert(
  readSource("lib/friendship/pair.ts").includes("@internal"),
  "test-only friendship pair helpers documented",
);

console.log("PASS: dead code cleanup verified");
