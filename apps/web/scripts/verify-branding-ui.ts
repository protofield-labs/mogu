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

const agentBubbles = readSource("components/search/agent-chat-bubbles.tsx");
assert(agentBubbles.includes("MoguBrandIcon"), "agent chat uses brand icon for avatar");

const homeView = readSource("components/home/home-view.tsx");
assert(homeView.includes("PageTitle"), "home header uses page title");
assert(homeView.includes("homePageTitle"), "home header uses greeting helper");

const searchHeader = readSource("components/search/agent-chat-header.tsx");
assert(searchHeader.includes('PageTitle>検索'), "search header uses page title");

console.log("PASS: branding UI verified");
