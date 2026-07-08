/**
 * Collection empty state → chat handoff verification (#239).
 * Run via: pnpm exec tsx scripts/verify-collection-consult.ts
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildCollectionContextMessage,
  collectionConsultDisplayMessage,
} from "../src/lib/agent/collection-context-message";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const collectionContext = {
  kind: "collection" as const,
  collectionId: "col-1",
  collectionName: "恵比寿ランチ",
};

assert(
  buildCollectionContextMessage(collectionContext).includes("col-1"),
  "collection context message includes collection id",
);
assert(
  collectionConsultDisplayMessage(collectionContext).includes("恵比寿ランチ"),
  "collection display message includes collection name",
);
assert(
  buildCollectionContextMessage({ kind: "first-spot" }).includes("最初のお店探し"),
  "first-spot context message describes intent",
);

const sessionsRoute = readSource("app/api/v1/agent/sessions/route.ts");
assert(
  sessionsRoute.includes("seedAgentCollectionContext"),
  "session route seeds collection context",
);
assert(
  sessionsRoute.includes("collectionContext"),
  "session route applies collection context from body",
);

const collectionView = readSource("components/mypage/collection-detail-view.tsx");
assert(
  collectionView.includes("stashPendingCollectionConsult"),
  "collection empty state stashes pending consult",
);
assert(
  collectionView.includes('router.push("/search")'),
  "collection empty state navigates to chat",
);
assert(
  !collectionView.includes('href="/search"'),
  "collection empty state no longer plain search link",
);

const mapView = readSource("components/mypage/mypage-all-spots-map-view.tsx");
assert(
  mapView.includes('kind: "first-spot"'),
  "mypage map empty state stashes first-spot consult",
);
assert(
  mapView.includes('router.push("/search")'),
  "mypage map empty state navigates to chat",
);

const pendingModule = readSource("lib/mypage/pending-collection-consult.ts");
assert(
  pendingModule.includes("resolvePendingCollectionConsult"),
  "pending module resolves without early consume",
);
assert(
  pendingModule.includes("clearPendingRecommendation"),
  "collection stash clears stale recommendation handoff",
);

const agentChat = readSource("lib/agent/use-agent-chat.ts");
assert(
  agentChat.includes("resolvePendingCollectionConsult"),
  "agent chat resolves collection pending on connect",
);
assert(
  agentChat.includes("commitPendingCollectionConsult"),
  "agent chat commits collection pending after apply",
);
assert(
  agentChat.includes("clearAgentChatSession"),
  "collection pending clears stored session before new consult",
);

console.log("PASS: collection consult handoff verified");
