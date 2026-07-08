/**
 * Me profile provider verification (#202 Definition of Done).
 * Run via: pnpm exec tsx scripts/verify-me-provider.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { assert } from "./test-helpers/assert";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const meProvider = readSource("lib/mypage/me-provider.tsx");
assert(meProvider.includes("export function MeProvider"), "MeProvider exported");
assert(meProvider.includes("export function useMe"), "useMe exported");
assert(meProvider.includes("PROFILE_UPDATED_EVENT"), "MeProvider listens for profile updates");
assert(meProvider.includes("BADGES_UPDATED_EVENT"), "MeProvider refreshes counts on badge events");
assert(!meProvider.includes("usePathname"), "MeProvider does not refetch on pathname");
assert(meProvider.includes("fetchMe()"), "MeProvider loads profile once");

const useMeBadges = readSource("lib/mypage/use-me-badges.tsx");
assert(useMeBadges.includes("fetchMeBadges"), "badges provider loads badge counts");
assert(!useMeBadges.includes("fetchMe("), "badges provider does not load profile");

const layout = readFileSync(
  join(process.cwd(), "src", "app", "(protected)", "layout.tsx"),
  "utf8",
);
assert(layout.includes("<MeProvider>"), "protected layout wraps MeProvider");
assert(layout.includes("<MeBadgesProvider>"), "protected layout wraps MeBadgesProvider");

const mypageView = readSource("components/mypage/mypage-view.tsx");
assert(mypageView.includes("useMe()"), "mypage reads profile from context");
assert(!mypageView.includes("fetchMe()"), "mypage no longer fetches profile directly");

const homeView = readSource("components/home/home-view.tsx");
assert(homeView.includes("useMe()"), "home reads profile from context");
assert(!homeView.includes("fetchMe()"), "home no longer fetches profile on load");

console.log("PASS: me provider verified");
