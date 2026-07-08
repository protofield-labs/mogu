/**
 * Design refresh verification (#101 Definition of Done).
 * Run via: pnpm exec tsx scripts/verify-design-refresh.ts
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { filterPillClass } from "../src/lib/ui/filter-pill";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), "src", relativePath), "utf8");
}

function main() {
  const designTokens = readFileSync(
    join(process.cwd(), "../../docs/design-tokens.md"),
    "utf8",
  );
  assert(designTokens.includes("Elevation ルール"), "design tokens document elevation");
  assert(designTokens.includes("アクセント適用先ルール"), "design tokens document accent usage");
  assert(designTokens.includes("NavRow"), "design tokens document NavRow pattern");

  const card = readSource("components/ui/card.tsx");
  assert(!card.includes("border border-border"), "SurfaceCard drops card border");
  assert(card.includes("shadow-md"), "SurfaceCard uses elevation shadow");

  const pageTitle = readSource("components/ui/page-title.tsx");
  assert(pageTitle.includes("text-2xl font-semibold"), "PageTitle uses large hierarchy");

  const navRow = readSource("components/ui/nav-row.tsx");
  assert(navRow.includes("ChevronRight"), "NavRow shows chevron");
  assert(navRow.includes("shadow-sm"), "NavRow uses elevation");

  const mypageView = readSource("components/mypage/mypage-view.tsx");
  assert(mypageView.includes("MypageAccountSheet"), "mypage includes account settings row");
  assert(mypageView.includes("MypageNavTiles"), "mypage includes nav tiles");
  assert(mypageView.includes("ProfileHeroCard"), "mypage includes hero card");

  const profileHero = readSource("components/mypage/profile-hero-card.tsx");
  assert(!profileHero.includes("rotateY"), "hero card is display-only");
  assert(profileHero.includes("shadow-md"), "hero card uses elevation");

  const homeView = readSource("components/home/home-view.tsx");
  assert(homeView.includes("MoguWordmark"), "home uses brand wordmark");

  const searchHeader = readSource("components/search/agent-chat-header.tsx");
  assert(searchHeader.includes('PageTitle>検索'), "search uses page title");

  const tabBar = readSource("components/tab-bar.tsx");
  assert(tabBar.includes("icon: User"), "tab bar uses profile icon for mypage");
  assert(tabBar.includes("useMeBadges"), "tab bar reads badge state");
  assert(tabBar.includes("text-primary"), "tab bar accents active tab");

  const protectedLayout = readFileSync(
    join(process.cwd(), "src", "app", "(protected)", "layout.tsx"),
    "utf8",
  );
  assert(
    protectedLayout.includes("<MeBadgesProvider>") &&
      protectedLayout.includes("<MeBadgesProvider>\n      <AuthGate>"),
    "MeBadgesProvider wraps auth gate so skeleton TabBar can prerender",
  );

  const notificationButton = readSource("components/home/home-notification-button.tsx");
  assert(notificationButton.includes("shadow-md"), "notification bell is floating elevation");
  assert(!notificationButton.includes("border border-border"), "notification bell drops border");

  const structuredChips = readSource("components/search/agent-structured-chips.tsx");
  assert(structuredChips.includes("filterPillClass"), "structured chips use filter pills");

  const chatBubbles = readSource("components/search/agent-chat-bubbles.tsx");
  assert(chatBubbles.includes("filterPillClass"), "quick replies use filter pills");

  assert(filterPillClass(true).includes("bg-primary"), "selected pill uses primary");

  console.log("PASS: design refresh verified");
}

main();
