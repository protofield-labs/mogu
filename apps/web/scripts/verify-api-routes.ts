/**
 * API route helpers verification (#111).
 * Run via: pnpm exec tsx scripts/verify-api-routes.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { encodeFriendshipPairId } from "../src/lib/friendship/pair";
import {
  collectionsListQuerySchema,
  feedQuerySchema,
  friendRequestsQuerySchema,
  pairIdRouteParamsSchema,
  provisionBodySchema,
  userSearchQuerySchema,
} from "../src/lib/api/route-schemas";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

assert(
  !existsSync(join(process.cwd(), "src/app/api/v1/users/me/route.ts")),
  "duplicate /users/me route removed",
);

const usersBrowserApi = readSource("lib/users/browser-api.ts");
assert(
  usersBrowserApi.includes('"/api/v1/me"'),
  "users browser-api uses /api/v1/me",
);
assert(
  !usersBrowserApi.includes("/api/v1/users/me"),
  "users browser-api must not call /users/me",
);

const provisionRoute = readSource("app/api/v1/users/provision/route.ts");
assert(
  provisionRoute.includes("parseJsonBody"),
  "provision route uses parseJsonBody",
);
assert(
  !provisionRoute.includes("Response.json({ user }"),
  "provision returns flat User shape",
);

const provisionClient = readSource("lib/auth/provision.ts");
assert(
  !provisionClient.includes("data.user"),
  "auth provision client expects flat User",
);

assert(
  readSource("lib/api/parse-json-body.ts").includes("export async function parseJsonBody"),
  "parseJsonBody helper exists",
);

assert(pairIdRouteParamsSchema.safeParse({ pairId: "" }).success === false, "pairId rejects empty");
assert(
  pairIdRouteParamsSchema.safeParse({
    pairId: encodeFriendshipPairId({
      userLow: "11111111-1111-4111-8111-111111111111",
      userHigh: "22222222-2222-4222-8222-222222222222",
    }),
  }).success,
  "pairId accepts encoded friendship pair key",
);
assert(feedQuerySchema.safeParse({}).success, "feed query allows empty");
assert(collectionsListQuerySchema.safeParse({ ownerId: "me" }).success, "collections ownerId query");
assert(userSearchQuerySchema.safeParse({ q: "Ken" }).success, "user search query");
assert(friendRequestsQuerySchema.safeParse({ box: "in" }).success, "friend requests query");
assert(provisionBodySchema.safeParse({ displayName: "Ken" }).success, "provision body");

const routeFiles = [
  "app/api/v1/collections/route.ts",
  "app/api/v1/users/route.ts",
  "app/api/v1/feed/route.ts",
  "app/api/v1/friends/requests/[pairId]/accept/route.ts",
];
for (const file of routeFiles) {
  const source = readSource(file);
  assert(source.includes("parseJsonBody") || source.includes("parseSearchParams") || source.includes("parseRouteParams"), `${file} uses api parse helpers`);
  assert(!source.includes("await req.json()"), `${file} must not inline req.json()`);
}

console.log("PASS: API route helpers verified");
