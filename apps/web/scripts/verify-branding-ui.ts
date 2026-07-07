/**
 * Branding UI verification (#162 Definition of Done).
 * Run via: pnpm exec tsx scripts/verify-branding-ui.ts
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const brandIcon = readSource("components/brand/mogu-brand-icon.tsx");
assert(brandIcon.includes("Beef"), "brand icon uses Beef mark");
assert(brandIcon.includes("aria-hidden"), "brand icon is decorative");

const wordmark = readSource("components/brand/mogu-wordmark.tsx");
assert(wordmark.includes("text-lg font-semibold"), "wordmark uses larger header typography");

const tabBar = readSource("components/tab-bar.tsx");
assert(tabBar.includes("MoguBrandIcon"), "search tab uses brand icon");
assert(!tabBar.includes("Sparkles"), "search tab no longer uses Sparkles");

const agentChat = readSource("components/search/agent-chat.tsx");
assert(agentChat.includes("MoguBrandIcon"), "agent chat uses brand icon for avatar/header");
assert(agentChat.includes("MoguWordmark"), "agent chat uses shared wordmark");

const homeView = readSource("components/home/home-view.tsx");
assert(homeView.includes("MoguWordmark"), "home header uses shared wordmark");
assert(homeView.includes("MoguBrandIcon"), "home header uses brand icon");

console.log("PASS: branding UI verified");
