/**
 * a11y fixes verification (#235, #236, #237).
 * Run via: pnpm exec tsx scripts/verify-a11y-fixes.ts
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { handleHorizontalCarouselKeyDown } from "../src/lib/ui/horizontal-carousel-keydown";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const sheet = readSource("components/ui/sheet.tsx");
assert(sheet.includes("export function SheetTitle"), "SheetTitle exported");
assert(sheet.includes("aria-labelledby"), "dialog uses aria-labelledby");
assert(sheet.includes("useLayoutEffect"), "sheet title registers before dialog paint");

const viewTabs = readSource("components/collections/collection-spot-view-tabs.tsx");
assert(viewTabs.includes("aria-pressed"), "view toggle uses pressed state");
assert(!viewTabs.includes('role="tab"'), "incomplete tabs pattern removed");

const feedCard = readSource("components/home/feed-item-card.tsx");
assert(feedCard.includes("FEED_PHOTO_CAROUSEL_LABEL"), "feed carousel label explains activation (#290)");
assert(feedCard.includes("overflow-x-auto"), "feed carousel scrolls on focused element");
assert(!feedCard.match(/role="group"[\s\S]*overflow-x-auto[\s\S]*<div className="flex snap-x/),
  "feed carousel does not nest scroll container inside group wrapper");
assert(feedCard.includes("handleHorizontalCarouselKeyDown"), "feed carousel supports arrow keys");

const feedActions = readSource("components/home/feed-item-actions.tsx");
assert(feedActions.includes("likeButtonAriaLabel"), "like button aria includes count (#290)");
assert(feedActions.includes('aria-live="polite"'), "like count live region (#290)");
assert(feedActions.includes("saveIconButtonAriaLabel"), "save icon documents picker (#290)");
assert(feedActions.includes("saveButtonA11yProps"), "save exposes picker popup (#290)");

const spotMedia = readSource("components/spots/spot-detail-media.tsx");
assert(spotMedia.includes('aria-label": "写真"'), "spot detail carousel labeled");
assert(spotMedia.includes("handleHorizontalCarouselKeyDown"), "spot detail carousel keyboard scroll");

const spotDetailSheet = readSource("components/spots/spot-detail-sheet.tsx");
assert(spotDetailSheet.includes("ariaLabel={title}"), "spot detail sheet names dialog");

// Smoke: arrow key handler scrolls without throwing.
const scrollBy = (delta: number) => {
  /* noop */
};
const mockTarget = {
  clientWidth: 100,
  scrollBy: ({ left }: { left: number }) => scrollBy(left),
} as unknown as HTMLElement;

let scrolled = 0;
(mockTarget as { scrollBy: (opts: { left: number }) => void }).scrollBy = ({
  left,
}: {
  left: number;
}) => {
  scrolled = left;
};

handleHorizontalCarouselKeyDown(
  {
    key: "ArrowRight",
    preventDefault: () => {},
    currentTarget: mockTarget,
  } as unknown as React.KeyboardEvent<HTMLElement>,
);
assert(scrolled === 100, "arrow right scrolls one viewport width");

console.log("PASS: a11y fixes verified");
