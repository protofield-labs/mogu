/**
 * Persona intro onboarding (#291).
 * Run via: pnpm exec tsx scripts/verify-persona-intro.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { assert } from "./test-helpers/assert";
import {
  PERSONA_INTRO_LEAD,
  PERSONA_INTRO_PROFILES,
  PERSONA_INTRO_SEEN_KEY,
  personaImageForPersonaKey,
  personaImageForThinkingMessage,
} from "../src/lib/agent/persona-intro";
import { PERSONA_THINKING } from "../src/lib/agent/stream-parser";

const root = join(process.cwd(), "src");
const publicRoot = join(process.cwd(), "public");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

assert(PERSONA_INTRO_SEEN_KEY === "mogu:persona-intro-seen:v1", "storage key versioned");
assert(PERSONA_INTRO_PROFILES.length === 2, "two persona profiles");
assert(
  PERSONA_INTRO_PROFILES[0]?.role === "サク飲み担当",
  "ken role matches #288",
);
assert(
  PERSONA_INTRO_PROFILES[1]?.role === "大人デート担当",
  "aoi role matches #288",
);
assert(PERSONA_INTRO_LEAD.includes("2人の味覚"), "lead explains dual advisors");
assert(
  personaImageForThinkingMessage(PERSONA_THINKING.ken!) === "/personas/ken.png",
  "thinking maps ken image",
);
assert(
  personaImageForThinkingMessage(PERSONA_THINKING.aoi!) === "/personas/aoi.png",
  "thinking maps aoi image",
);
assert(
  personaImageForPersonaKey("ken") === "/personas/ken.png",
  "persona key maps ken avatar (#312)",
);
assert(
  personaImageForPersonaKey("aoi") === "/personas/aoi.png",
  "persona key maps aoi avatar (#312)",
);

const bubbles = readSource("components/search/agent-chat-bubbles.tsx");
assert(
  bubbles.includes("personaImageForPersonaKey"),
  "agent avatar uses persona images (#312)",
);
assert(
  bubbles.includes("personaKey={entry.personaKey}"),
  "agent bubble passes persona key to avatar (#312)",
);

assert(
  existsSync(join(publicRoot, "personas/ken.png")),
  "ken persona image exists",
);
assert(
  existsSync(join(publicRoot, "personas/aoi.png")),
  "aoi persona image exists",
);

const introCard = readSource("components/search/persona-intro-card.tsx");
assert(introCard.includes("PersonaIntroCard"), "intro card component");
assert(introCard.includes("わかった"), "intro card dismiss control");

const agentChatContext = readSource("components/search/agent-chat-context.tsx");
assert(
  agentChatContext.includes("usePersonaIntro"),
  "agent chat context uses persona intro hook",
);
assert(
  agentChatContext.includes("showPersonaIntroAgain"),
  "context exposes re-show intro action",
);

const personaIntroHook = readSource("lib/agent/use-persona-intro.ts");
assert(
  personaIntroHook.includes("useSyncExternalStore"),
  "intro hook uses sync external store",
);
assert(
  personaIntroHook.includes("hasSeenPersonaIntro"),
  "intro hook gates on storage",
);

const autoScroll = readSource("components/search/agent-chat-auto-scroll.tsx");
assert(
  autoScroll.includes("preferStart = state.showPersonaIntro"),
  "auto-scroll keeps intro in view",
);
assert(autoScroll.includes("preferStart"), "auto-scroll accepts preferStart");
assert(autoScroll.includes("scrollToStart"), "auto-scroll can scroll to start");
assert(
  autoScroll.includes("entryCount <= 1"),
  "intro preferStart yields to chat after first message",
);

const transcript = readSource("components/search/agent-chat-transcript.tsx");
assert(transcript.includes("PersonaIntroCard"), "transcript renders intro");
assert(
  transcript.includes("personaImageForThinkingMessage"),
  "thinking markers use persona images",
);

const header = readSource("components/search/agent-chat-header.tsx");
assert(
  header.includes("味覚アドバイザーの紹介"),
  "header exposes re-show control",
);
assert(
  header.includes("actions.showPersonaIntroAgain"),
  "header re-show wired to context action",
);

console.log("PASS: persona intro verified");
