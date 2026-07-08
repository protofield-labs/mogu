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
assert(homeView.includes("MoguBrandIcon"), "home header uses brand icon");
assert(homeView.includes("MoguWordmark"), "home header uses wordmark");

const searchHeader = readSource("components/search/agent-chat-header.tsx");
assert(searchHeader.includes('PageTitle>検索'), "search header uses page title");

const mypageView = readSource("components/mypage/mypage-view.tsx");
assert(mypageView.includes("MoguBrandIcon"), "mypage agent promo uses brand icon");

const mypageTopBar = readSource("components/mypage/mypage-top-bar.tsx");
assert(mypageTopBar.includes("MoguWordmark"), "mypage header uses wordmark");
assert(mypageTopBar.includes("logout"), "mypage header wires logout");
assert(!mypageView.includes("Sparkles"), "mypage no longer uses Sparkles");

const collectionGrid = readSource("components/mypage/collection-grid.tsx");
assert(collectionGrid.includes("MoguBrandIcon"), "collection upsell uses brand icon");
assert(!collectionGrid.includes("Sparkles"), "collection grid no longer uses Sparkles");

const agentComposer = readSource("components/search/agent-chat-composer.tsx");
assert(!agentComposer.includes("Sparkles"), "agent composer no longer uses Sparkles");

const homeEmptyState = readSource("components/home/home-empty-state.tsx");
assert(!homeEmptyState.includes("Sparkles"), "home empty state no longer uses Sparkles");

console.log("PASS: branding UI verified");
