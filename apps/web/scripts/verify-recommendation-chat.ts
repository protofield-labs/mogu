/**
 * Home recommendation → chat handoff verification (#204).
 * Run via: pnpm exec tsx scripts/verify-recommendation-chat.ts
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildRecommendationContextMessage,
  recommendationToContext,
} from "../src/lib/agent/recommendation-context-message";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const sampleRecommendation = {
  spot: {
    id: "spot-1",
    placeId: "ChIJ123",
    addedBy: "user-1",
    collectionId: "col-1",
    photoUrls: [],
    comment: "nice",
    rating: "again" as const,
    structuredTags: { area: null, genre: null, situation: null },
    freeTags: [],
    savedCount: 2,
    originUserId: null,
    createdAt: "2026-07-08T00:00:00.000Z",
  },
  assertion: "今夜はここがおすすめ",
  evidence: "Kenさんが3回保存",
  alternatives: [],
  savedByMe: false,
};

const context = recommendationToContext(sampleRecommendation);
assert(context.placeId === "ChIJ123", "recommendation context includes place id");
assert(
  buildRecommendationContextMessage(context).includes("ChIJ123"),
  "context message includes place id for agent",
);
assert(
  buildRecommendationContextMessage(context).includes("今夜はここがおすすめ"),
  "context message includes assertion",
);

const sessionsRoute = readSource("app/api/v1/agent/sessions/route.ts");
assert(
  sessionsRoute.includes("seedAgentRecommendationContext"),
  "session route seeds recommendation context",
);
assert(
  sessionsRoute.includes("createAgentSessionBodySchema"),
  "session route validates optional body",
);

const detailSheet = readSource("components/home/recommendation-detail-sheet.tsx");
assert(detailSheet.includes("SpotDetailSheet"), "recommendation detail uses spot sheet");
assert(detailSheet.includes("stashPendingRecommendation"), "consult CTA stashes pending");
assert(detailSheet.includes('router.push("/search")'), "consult CTA navigates to chat");

const agentChat = readSource("lib/agent/use-agent-chat.ts");
assert(agentChat.includes("recommendationToContext"), "agent chat maps recommendation to context");
assert(agentChat.includes("clearAgentChatSession"), "pending recommendation clears stored session");

console.log("PASS: recommendation chat handoff verified");
