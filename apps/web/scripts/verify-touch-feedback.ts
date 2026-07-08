/**
 * Touch feedback utilities verification (#125).
 * Run via: pnpm exec tsx scripts/verify-touch-feedback.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { assert } from "./test-helpers/assert";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function main() {
  const globalsCss = readFileSync(join(root, "app/globals.css"), "utf8");
  assert(globalsCss.includes(".mogu-touch-card"), "touch card utility exists");
  assert(globalsCss.includes(".mogu-touch-row"), "touch row utility exists");
  assert(globalsCss.includes(".mogu-touch-icon"), "touch icon utility exists");
  assert(globalsCss.includes(".mogu-touch-target"), "touch target utility exists");
  assert(
    globalsCss.includes("-webkit-tap-highlight-color: transparent"),
    "native tap highlight disabled",
  );

  const touchFeedback = readSource("lib/ui/touch-feedback.ts");
  assert(touchFeedback.includes("touchCardClass"), "touchCardClass exported");

  const appShell = readSource("components/app-shell.tsx");
  assert(
    !appShell.includes("mainTabBarPaddingClass"),
    "app shell avoids duplicate tab bar padding (tab bar is a flex sibling)",
  );

  const tabBar = readSource("components/tab-bar.tsx");
  assert(tabBar.includes("touchIconClass"), "tab bar uses icon press feedback");

  const collectionGrid = readSource("components/mypage/collection-grid.tsx");
  assert(!collectionGrid.includes("h-7"), "collection grid avoids sub-44px buttons");
  assert(collectionGrid.includes("touchCardClass"), "collection tile uses card feedback");
  assert(collectionGrid.includes("min-h-11"), "collection actions meet 44px minimum");

  const avatarRow = readSource("components/home/avatar-row.tsx");
  assert(avatarRow.includes("touchRowClass"), "avatar row uses row feedback");

  const card = readSource("components/ui/card.tsx");
  assert(card.includes("touchCardClass"), "SurfaceCardInteractive uses card feedback");

  const feedItemCard = readSource("components/home/feed-item-card.tsx");
  assert(feedItemCard.includes("touchRowClass"), "feed item uses row feedback");
  assert(
    !feedItemCard.includes("touchCardClass"),
    "feed item avoids card press chrome",
  );

  const navTiles = readSource("components/mypage/mypage-nav-tiles.tsx");
  assert(navTiles.includes("touchCardClass"), "mypage nav tiles use card feedback");

  const friendsView = readSource("components/mypage/friends-view.tsx");
  assert(friendsView.includes("min-h-11"), "friend request button meets 44px minimum");

  const button = readSource("components/ui/button.tsx");
  assert(button.includes('icon: "size-11"'), "icon buttons meet 44px minimum");

  console.log("PASS: touch feedback verified");
}

main();
