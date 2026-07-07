/**
 * Large component split verification (#113).
 * Run via: pnpm exec tsx scripts/verify-component-splits.ts
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function lineCount(relativePath: string): number {
  return readSource(relativePath).split("\n").length;
}

const spotForm = lineCount("components/mypage/spot-form.tsx");
const spotList = readSource("components/mypage/spot-list.tsx");
const friendsView = lineCount("components/mypage/friends-view.tsx");
const friendsHook = readSource("lib/mypage/use-friends-view.ts");
const mypageView = lineCount("components/mypage/mypage-view.tsx");
const mypageHook = readSource("lib/mypage/use-mypage-collections.ts");
const agentChat = lineCount("components/search/agent-chat.tsx");
const agentHook = readSource("lib/agent/use-agent-chat.ts");

assert(spotForm < 280, "spot-form slimmed");
assert(spotList.includes("export function SpotList"), "spot list extracted");
assert(friendsView < 200, "friends-view slimmed");
assert(friendsHook.includes("export function useFriendsView"), "friends hook extracted");
assert(mypageView < 350, "mypage-view slimmed");
assert(mypageHook.includes("export function useMypageCollections"), "mypage collections hook");
assert(agentChat < 100, "agent-chat slimmed");
assert(agentHook.includes("export function useAgentChat"), "agent chat hook extracted");
assert(agentHook.includes("applyConsultationDetail"), "consultation resume in hook");

const agentBubbles = readSource("components/search/agent-chat-bubbles.tsx");
assert(agentBubbles.includes("export function AgentBubble"), "agent bubbles extracted");

const collectionFields = readSource("components/mypage/collection-form-fields.tsx");
assert(collectionFields.includes("export function CollectionFormFields"), "collection form fields extracted");

console.log("PASS: component splits verified");
