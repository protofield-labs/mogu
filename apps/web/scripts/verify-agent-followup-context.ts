/**
 * Agent follow-up same-place context (#264).
 * Run via: pnpm exec tsx scripts/verify-agent-followup-context.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { assert } from "./test-helpers/assert";
import {
  buildFollowUpUserMessage,
  findLatestRecommendation,
  isSamePlaceFollowUp,
} from "../src/lib/agent/followup-context";
import { buildPersonaCollectionContextMessage } from "../src/lib/agent/persona-collection-message";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

assert(isSamePlaceFollowUp("なぜこの店なの？"), "detects why-this-place follow-up");
assert(isSamePlaceFollowUp("もっと詳しく教えて"), "detects more-detail follow-up");
assert(
  isSamePlaceFollowUp("この店をおすすめしてくれた理由は？"),
  "detects why-recommended follow-up (おすすめして must not exclude)",
);
assert(!isSamePlaceFollowUp("別の店を探して"), "rejects new-search request");
assert(!isSamePlaceFollowUp("渋谷で店を探して"), "rejects fresh search request");
assert(
  !isSamePlaceFollowUp("渋谷でおすすめして"),
  "rejects bare recommend without this-place cue",
);

const followUp = buildFollowUpUserMessage("なぜこの店？", {
  placeId: "ChIJ123",
  spotId: "spot-1",
  assertion: "今夜はここがおすすめ",
  evidence: "Kenが『すき』",
});
assert(followUp.includes("ChIJ123"), "follow-up message keeps place_id");
assert(followUp.includes("[ユーザーの発言]"), "follow-up wraps user text");
assert(followUp.includes("なぜこの店？"), "follow-up keeps user text");
assert(
  buildFollowUpUserMessage("hello", null) === "hello",
  "no active recommendation leaves text unchanged",
);

const latest = findLatestRecommendation([
  { kind: "user" },
  {
    kind: "agent",
    recommendation: {
      spot: {
        id: "s1",
        placeId: "p1",
        addedBy: "u1",
        collectionId: "c1",
        photoUrls: [],
        comment: "",
        rating: "again",
        structuredTags: { area: null, genre: null, situation: null },
        freeTags: [],
        savedCount: 1,
        originUserId: null,
        createdAt: "2026-07-09T00:00:00.000Z",
      },
      assertion: "a",
      evidence: "e",
      alternatives: [],
    },
  },
  { kind: "user" },
]);
assert(latest?.spot.id === "s1", "finds latest recommendation from history");

const personaMsg = buildPersonaCollectionContextMessage([
  {
    personaKey: "ken",
    displayName: "Ken",
    collectionName: "中目黒サク飲み",
    tags: "居酒屋 / コスパ / 友人",
    spots: [
      {
        placeId: "ChIJseed",
        spotId: "22222222-2222-4222-8222-222222222201",
        tagArea: "中目黒",
        tagGenre: "居酒屋",
        tagSituation: "サク飲み",
        comment: "半個室",
        rating: "again",
      },
    ],
  },
]);
assert(
  personaMsg.includes("[ペルソナコレクション実データ]"),
  "persona block header present",
);
assert(personaMsg.includes("ChIJseed"), "persona block lists place_id");
assert(personaMsg.includes("中目黒サク飲み"), "persona block lists collection");

const messageClient = readSource("lib/agent/message-client.ts");
const resolveAgentTurn = readSource("lib/agent/resolve-agent-turn.ts");
assert(
  messageClient.includes("buildFollowUpUserMessage"),
  "message client wires follow-up context",
);
assert(
  messageClient.includes("getLatestRecommendationForSession"),
  "message client loads prior recommendation",
);
assert(
  resolveAgentTurn.includes("anchorSpotId"),
  "turn resolver pins assertion card spot",
);
assert(
  messageClient.includes("seedAgentPersonaCollectionContext"),
  "message client can seed persona collections",
);

const sessionsRoute = readSource("app/api/v1/agent/sessions/route.ts");
assert(
  sessionsRoute.includes("seedAgentPersonaCollectionContext"),
  "session create seeds persona collection data",
);

const pick = readSource("lib/recommendations/pick.ts");
assert(pick.includes("anchorSpotId"), "pickDailyRecommendation supports anchor");

console.log("PASS: agent follow-up context verified");
