/**
 * Motion language verification (#128 Definition of Done).
 * Run via: pnpm exec tsx scripts/verify-motion-ui.ts
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  MOGU_STAGGER_MS,
  moguEnterDelayStyle,
  moguEnterMotionClass,
} from "../src/lib/ui/motion";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function main() {
  assert(moguEnterMotionClass.includes("animate-in"), "enter motion uses animate-in");
  assert(moguEnterMotionClass.includes("slide-in-from-bottom-2"), "enter motion slides up");
  assert(moguEnterMotionClass.includes("motion-reduce:animate-none"), "enter motion respects reduce");
  assert(
    moguEnterDelayStyle(2)?.animationDelay === `${2 * MOGU_STAGGER_MS}ms`,
    "stagger delay scales by index",
  );
  assert(moguEnterDelayStyle(0) === undefined, "first item has no delay");

  const globalsCss = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  assert(globalsCss.includes("mogu-avatar-ring-new-pulse"), "avatar new ring pulse class");
  assert(globalsCss.includes("mogu-avatar-ring-pulse"), "avatar ring pulse keyframes");
  assert(globalsCss.includes("prefers-reduced-motion"), "avatar pulse respects reduce");

  const feedItemCard = readSource("components/home/feed-item-card.tsx");
  assert(feedItemCard.includes("moguEnterMotionClass"), "feed card uses enter motion");
  assert(feedItemCard.includes("enterIndex"), "feed card accepts stagger index");

  const homeView = readSource("components/home/home-view.tsx");
  assert(homeView.includes("PullToRefresh"), "home view supports pull-to-refresh");
  assert(homeView.includes("handlePullRefresh"), "home view defines pull refresh");
  assert(homeView.includes("Spinner"), "load more shows spinner");
  assert(homeView.includes("initialFeedCount"), "feed stagger limited to first paint");

  const collectionGrid = readSource("components/mypage/collection-grid.tsx");
  assert(collectionGrid.includes("moguEnterMotionClass"), "collection grid uses enter motion");

  const friendsSection = readSource("components/mypage/friends-approved-section.tsx");
  assert(friendsSection.includes("moguEnterMotionClass"), "friends list uses enter motion");

  const avatar = readSource("components/ui/avatar.tsx");
  assert(avatar.includes("mogu-avatar-ring-new-pulse"), "avatar uses finite new ring pulse");
  assert(!avatar.includes("animate-pulse"), "avatar drops infinite pulse ring");

  const agentChat = readSource("components/search/agent-chat.tsx");
  assert(agentChat.includes("AgentChatAutoScroll"), "agent chat auto-scrolls on send");
  assert(agentChat.includes("sessionId={chat.sessionId}"), "auto-scroll tracks consultation session");
  assert(
    agentChat.includes("MessageScrollerProvider"),
    "agent chat composer stays in scroller provider",
  );

  const agentComposer = readSource("components/search/agent-chat-composer.tsx");
  assert(
    agentComposer.includes("useVisualViewportOffset"),
    "agent composer avoids keyboard overlap",
  );

  const pullToRefresh = readSource("components/ui/pull-to-refresh.tsx");
  assert(pullToRefresh.includes("touchstart"), "pull-to-refresh listens for touch");
  assert(pullToRefresh.includes("PULL_THRESHOLD_PX"), "pull-to-refresh defines threshold");

  console.log("PASS: motion UI verified");
}

main();
