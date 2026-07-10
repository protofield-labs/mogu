/**
 * Agent candidate spot cards (#287).
 * Run via: pnpm exec tsx scripts/verify-agent-candidate-spots.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { assert } from "./test-helpers/assert";
import {
  CANDIDATE_FOLLOWUP_TEXT,
  CANDIDATE_ONLY_REPLY_TEXT,
  MAX_CANDIDATE_SPOTS,
  extractCandidateSpotMarkers,
  mergeCandidateSpotMarkers,
} from "../src/lib/agent/candidate-spot-markers";
import {
  buildCandidateFollowUpUserMessage,
  isSamePlaceFollowUp,
} from "../src/lib/agent/followup-context";
import { createAgentEntry } from "../src/lib/agent/chat-helpers";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

// --- marker extraction -------------------------------------------------

const reply = [
  "恵比寿なら2軒どうでしょう。",
  "落ち着いた半個室のお店と、サクッと入れる立ち飲みです。どちらが気になりますか？",
  "[[候補 spot_id=22222222-2222-4222-8222-222222222303 place_id=ChIJebisuDate01]]",
  "[[候補 spot_id=22222222-2222-4222-8222-222222222203 place_id=ChIJebisuStand01]]",
].join("\n");

const extracted = extractCandidateSpotMarkers(reply);
assert(extracted.markers.length === 2, "extracts two candidate markers");
assert(
  extracted.markers[0]?.spotId === "22222222-2222-4222-8222-222222222303",
  "keeps marker order",
);
assert(
  extracted.markers[1]?.placeId === "ChIJebisuStand01",
  "extracts place_id",
);
assert(!extracted.text.includes("[[候補"), "strips marker lines from text");
assert(
  extracted.text.includes("どちらが気になりますか？"),
  "keeps visible reply text",
);

// Google does not guarantee a place_id alphabet — unusual chars must not
// drop the marker (thumbnails would silently vanish otherwise).
const oddIds = extractCandidateSpotMarkers(
  "候補です。\n[[候補 spot_id=22222222-2222-4222-8222-222222222303 place_id=ChIJ+odd/Chars==]]",
);
assert(oddIds.markers.length === 1, "tolerates non-base64url place_id chars");
assert(
  oddIds.markers[0]?.placeId === "ChIJ+odd/Chars==",
  "keeps unusual place_id verbatim",
);

const noMarkers = extractCandidateSpotMarkers("今夜はどんな気分？");
assert(noMarkers.markers.length === 0, "no markers on plain reply");
assert(noMarkers.text === "今夜はどんな気分？", "plain reply unchanged");

const dupes = extractCandidateSpotMarkers(
  [
    "候補です。",
    "[[候補 spot_id=s1 place_id=p1]]",
    "[[候補 spot_id=s1 place_id=p1]]",
    "[[候補 spot_id=s2 place_id=p2]]",
    "[[候補 spot_id=s3 place_id=p3]]",
    "[[候補 spot_id=s4 place_id=p4]]",
  ].join("\n"),
);
assert(
  dupes.markers.length === MAX_CANDIDATE_SPOTS,
  "dedupes and caps markers at 3",
);
assert(dupes.markers[2]?.spotId === "s3", "keeps first three unique markers");

const markerOnly = extractCandidateSpotMarkers(
  "[[候補 spot_id=s1 place_id=p1]]",
);
assert(markerOnly.markers.length === 1, "marker-only reply still extracts");
assert(
  markerOnly.text === CANDIDATE_ONLY_REPLY_TEXT,
  "marker-only reply falls back to friendly copy",
);
assert(
  !markerOnly.text.includes("[[候補"),
  "marker syntax never reaches the bubble",
);

// --- persona-only markers survive orchestrator rewrites (#313) ----------

// The orchestrator rewrote Aoi's proposal in its own words and dropped the
// marker lines — markers must still be mined from the persona raw text.
const orchestratorRewrite =
  "中目黒なら、静かにワインを楽しめるイタリアンが2軒あります。どちらが気になりますか？";
const personaRaw = [
  "参照: Aoiのコレクション『静かな二人時間』",
  "イル ヴァッフォと、トラットリア ヴィヴァはいかがでしょう。",
  "[[候補 spot_id=aoi-s1 place_id=ChIJAoi01]]",
  "[[候補 spot_id=aoi-s2 place_id=ChIJAoi02]]",
].join("\n");

const rewriteMarkers = mergeCandidateSpotMarkers(
  extractCandidateSpotMarkers(orchestratorRewrite).markers,
  extractCandidateSpotMarkers(personaRaw).markers,
);
assert(
  rewriteMarkers.length === 2,
  "persona-only markers survive orchestrator rewrite",
);
assert(
  rewriteMarkers[0]?.spotId === "aoi-s1" &&
    rewriteMarkers[1]?.placeId === "ChIJAoi02",
  "persona markers keep order and ids",
);

// Resolved-text markers take priority; duplicates across sources dedupe.
const mergedPriority = mergeCandidateSpotMarkers(
  [{ spotId: "s1", placeId: "p1" }],
  [
    { spotId: "s1", placeId: "p1" },
    { spotId: "s2", placeId: "p2" },
  ],
  [
    { spotId: "s2", placeId: "p2" },
    { spotId: "s3", placeId: "p3" },
    { spotId: "s4", placeId: "p4" },
  ],
);
assert(
  mergedPriority.length === MAX_CANDIDATE_SPOTS,
  "merge dedupes across sources and caps at 3",
);
assert(
  mergedPriority[0]?.spotId === "s1" &&
    mergedPriority[1]?.spotId === "s2" &&
    mergedPriority[2]?.spotId === "s3",
  "merge keeps resolved-text priority order",
);

assert(
  mergeCandidateSpotMarkers([], [], []).length === 0,
  "merge with no markers stays empty",
);

// --- candidate follow-up context ---------------------------------------

const followUp = buildCandidateFollowUpUserMessage(CANDIDATE_FOLLOWUP_TEXT, {
  spotId: "spot-1",
  placeId: "ChIJ123",
  tagLine: "恵比寿 / 居酒屋",
  comment: "半個室",
});
assert(followUp.includes("ChIJ123"), "candidate follow-up keeps place_id");
assert(followUp.includes("spot-1"), "candidate follow-up keeps spot_id");
assert(followUp.includes("[ユーザーの発言]"), "candidate follow-up wraps user text");
assert(
  followUp.includes(CANDIDATE_FOLLOWUP_TEXT),
  "candidate follow-up keeps user text",
);
assert(
  followUp.includes("すり替え"),
  "candidate follow-up forbids switching places",
);
assert(
  isSamePlaceFollowUp(CANDIDATE_FOLLOWUP_TEXT),
  "tap text also reads as same-place follow-up (#264)",
);

// --- entry shape ---------------------------------------------------------

const entry = createAgentEntry({
  text: "候補です",
  candidateSpots: [
    {
      id: "s1",
      placeId: "p1",
      addedBy: "u1",
      collectionId: "c1",
      photoUrls: [],
      comment: "半個室",
      rating: "again",
      structuredTags: { area: "恵比寿", genre: "居酒屋", situation: null },
      freeTags: [],
      savedCount: 1,
      originUserId: null,
      createdAt: "2026-07-09T00:00:00.000Z",
    },
  ],
});
assert(
  entry.kind === "agent" && entry.candidateSpots?.length === 1,
  "agent entry carries candidate spots",
);
const emptyEntry = createAgentEntry({ text: "候補なし", candidateSpots: [] });
assert(
  emptyEntry.kind === "agent" && emptyEntry.candidateSpots === undefined,
  "empty candidate list is omitted",
);

// --- wiring --------------------------------------------------------------

const messageClient = readSource("lib/agent/message-client.ts");
assert(
  messageClient.includes("extractCandidateSpotMarkers"),
  "message client strips candidate markers",
);
assert(
  messageClient.includes("buildAgentCandidateSpots"),
  "message client builds candidate spot DTOs",
);
assert(
  messageClient.includes("getCandidatePinContext"),
  "message client validates tapped candidate",
);
assert(
  messageClient.includes("buildCandidateFollowUpUserMessage"),
  "message client pins tapped candidate context",
);
assert(
  messageClient.includes("!input.candidateSpot"),
  "candidate taps never fall back to the #264 recommendation pin",
);
assert(
  messageClient.includes("useCandidateCards") &&
    messageClient.includes("resolvedTextMarkers.length > 0"),
  "resolved-text markers always route to candidate cards",
);
assert(
  messageClient.includes("hasCandidateMarkers && !isAgentAssertionTurn(text)"),
  "mined-only markers become cards on non-assertive turns (#313)",
);
assert(
  messageClient.includes("!useCandidateCards && isAgentAssertionTurn(text)"),
  "assertive turns with mined-only markers use DB-backed recommendations",
);
assert(
  messageClient.includes("CANDIDATE_RESOLUTION_FAILED_TEXT"),
  "message client replaces prose when no candidate markers resolve",
);
assert(
  messageClient.includes("displayText = recommendation.assertion"),
  "assertion turns show DB-backed assertion text, not model shop names",
);
assert(
  messageClient.includes("mergeCandidateSpotMarkers"),
  "message client merges markers across stream authors (#313)",
);
assert(
  messageClient.includes("streamResult.personaText") &&
    messageClient.includes("streamResult.orchestratorText"),
  "message client mines markers from persona and orchestrator raw texts (#313)",
);
assert(
  messageClient.includes("agent candidate markers dropped during DB resolution") &&
    messageClient.includes("agent candidate spot resolution failed"),
  "message client logs marker drop reasons for triage (#313)",
);

const candidateSpots = readSource("lib/agent/candidate-spots.ts");
assert(
  candidateSpots.includes("withAuthRls"),
  "candidate spots resolve under RLS",
);
assert(
  candidateSpots.includes("row.placeId === marker.placeId") ||
    candidateSpots.includes("row.placeId === ref.placeId"),
  "candidate spots verify spot/place pairing",
);

const cards = readSource("components/search/agent-candidate-spot-cards.tsx");
assert(
  cards.includes("export function AgentCandidateSpotCards"),
  "candidate cards component extracted",
);
assert(cards.includes("SpotListRow"), "candidate cards use list row layout (#314)");
assert(
  cards.includes("sendCandidateFollowUp"),
  "candidate card tap sends follow-up via context",
);
assert(
  cards.includes("flex-col") && cards.includes("gap-2"),
  "candidate cards stack vertically (#314)",
);
assert(
  !cards.includes("snap-x") && !cards.includes("overflow-x-auto"),
  "candidate cards no longer scroll horizontally (#314)",
);

const bubbles = readSource("components/search/agent-chat-bubbles.tsx");
assert(
  bubbles.includes("AgentCandidateSpotCards"),
  "agent bubble renders candidate cards",
);

const context = readSource("components/search/agent-chat-context.tsx");
assert(
  context.includes("sendCandidateFollowUp"),
  "chat context exposes candidate follow-up action",
);

const entriesSchema = readSource("lib/agent/consultation-entries.ts");
assert(
  entriesSchema.includes("candidateSpots"),
  "consultation entries persist candidate spots",
);

const agentSchema = readSource("lib/api/schemas/agent.ts");
assert(
  agentSchema.includes("candidateSpots"),
  "agent message schema includes candidate spots",
);

const orchestrator = readFileSync(
  join(process.cwd(), "..", "..", "agents", "mogu", "agent.py"),
  "utf8",
);
assert(
  orchestrator.includes("[[候補 spot_id=") &&
    orchestrator.includes("place_id="),
  "orchestrator emits candidate markers (#287)",
);
assert(
  orchestrator.includes("最大3件") || orchestrator.includes("最大 3 件"),
  "orchestrator caps candidates at 3",
);
assert(
  orchestrator.includes("そのまま転記"),
  "orchestrator is told to copy persona marker lines verbatim (#313)",
);
assert(
  orchestrator.includes("マーカー行を付けられない店名は本文にも書かない"),
  "orchestrator must not name shops without markers",
);

const kenPersona = readFileSync(
  join(process.cwd(), "..", "..", "agents", "mogu", "personas", "ken.py"),
  "utf8",
);
const aoiPersona = readFileSync(
  join(process.cwd(), "..", "..", "agents", "mogu", "personas", "aoi.py"),
  "utf8",
);
for (const [name, source] of [
  ["ken", kenPersona],
  ["aoi", aoiPersona],
] as const) {
  assert(
    source.includes("[[候補 spot_id=") && source.includes("place_id="),
    `${name} persona emits candidate markers`,
  );
  assert(
    !source.includes("デモ固定名"),
    `${name} persona no longer falls back to demo shop names`,
  );
}

console.log("PASS: agent candidate spot cards (#287)");
