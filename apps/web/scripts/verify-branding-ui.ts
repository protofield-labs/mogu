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
assert(brandIcon.includes('viewBox="0 0 64 64"'), "brand icon uses custom SVG symbol");
assert(!brandIcon.includes("Beef"), "brand icon no longer uses Lucide Beef");
assert(brandIcon.includes("text-mogu-brand"), "brand icon uses brand color token");
assert(brandIcon.includes("MoguTabIcon"), "brand icon exports tab-specific variant");
assert(brandIcon.includes("aria-hidden"), "brand icon is decorative");

const wordmark = readSource("components/brand/mogu-wordmark.tsx");
assert(wordmark.includes("text-mogu-wordmark"), "wordmark uses brand color token");
assert(wordmark.includes('viewBox="0 0 242 84"'), "wordmark uses custom SVG paths");
assert(wordmark.includes("sr-only"), "wordmark keeps accessible brand text");

const tabBar = readSource("components/tab-bar.tsx");
assert(tabBar.includes("MoguTabIcon"), "search tab uses monochrome-friendly brand icon");
assert(!tabBar.includes("Sparkles"), "search tab no longer uses Sparkles");

const agentBubbles = readSource("components/search/agent-chat-bubbles.tsx");
assert(agentBubbles.includes("MoguBrandIcon"), "agent chat uses brand icon for avatar");
assert(agentBubbles.includes("bg-transparent"), "agent avatar has no white container");
assert(
  agentBubbles.includes('<MoguBrandIcon className="size-8"'),
  "agent avatar fills its slot with the brand icon",
);

const authForm = readSource("components/auth/auth-form.tsx");
assert(authForm.includes("MoguBrandIcon"), "auth form uses brand icon");
assert(!authForm.includes("MoguWordmark"), "auth form shows only the centered brand icon");
assert(authForm.includes("mx-auto size-16"), "auth icon is centered and prominent");

const loginPage = readSource("app/login/page.tsx");
assert(loginPage.includes("今夜の店、もう迷わない。"), "login uses brand message");
assert(loginPage.includes("決め手は、友達の「すき」。"), "login uses friend-based value copy");
assert(loginPage.includes("whitespace-nowrap"), "login brand message stays on one line");

const feedActions = readSource("components/home/feed-item-actions.tsx");
assert(
  feedActions.includes('again: "bg-primary/10 text-primary"'),
  "positive rating badge uses brand color",
);
assert(
  feedActions.includes('no: "bg-blue-500/10 text-blue-700 dark:text-blue-400"'),
  "negative rating badge uses blue",
);

const homeView = readSource("components/home/home-view.tsx");
assert(homeView.includes('src="/mogu-logo.png"'), "home header uses supplied PNG logo");
assert(homeView.includes('alt="mogu"'), "home PNG logo has accessible alt text");

const searchHeader = readSource("components/search/agent-chat-header.tsx");
assert(searchHeader.includes("MoguBrandIcon"), "search header uses brand icon");
assert(searchHeader.includes("MoguWordmark"), "search header uses wordmark");
assert(!searchHeader.includes("PageTitle"), "search header no longer uses PageTitle");

const mypageView = readSource("components/mypage/mypage-view.tsx");
assert(mypageView.includes("MoguBrandIcon"), "mypage agent promo uses brand icon");

const profileHero = readSource("components/mypage/profile-hero-card.tsx");
assert(profileHero.includes("flex-col items-center"), "profile name sits below avatar");

const mypageTopBar = readSource("components/mypage/mypage-top-bar.tsx");
assert(mypageTopBar.includes("MoguWordmark"), "mypage header uses wordmark");
assert(mypageTopBar.includes("logout"), "mypage header wires logout");
assert(!mypageView.includes("Sparkles"), "mypage no longer uses Sparkles");

const collectionGrid = readSource("components/mypage/collection-grid.tsx");
assert(
  !collectionGrid.includes("合いそうなお店"),
  "collection grid no longer shows non-interactive upsell (#257)",
);
assert(!collectionGrid.includes("showUpsell"), "collection grid dropped showUpsell prop");
assert(!collectionGrid.includes("Sparkles"), "collection grid no longer uses Sparkles");

const agentComposer = readSource("components/search/agent-chat-composer.tsx");
assert(!agentComposer.includes("Sparkles"), "agent composer no longer uses Sparkles");

const homeEmptyState = readSource("components/home/home-empty-state.tsx");
assert(!homeEmptyState.includes("Sparkles"), "home empty state no longer uses Sparkles");

console.log("PASS: branding UI verified");
