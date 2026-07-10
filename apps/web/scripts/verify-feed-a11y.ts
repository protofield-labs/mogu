/**
 * Feed action a11y helpers (#290).
 * Run via: pnpm exec tsx scripts/verify-feed-a11y.ts
 */
import { assert } from "./test-helpers/assert";

import {
  FEED_PHOTO_CAROUSEL_LABEL,
  likeButtonAriaLabel,
  likeCountLiveText,
} from "../src/lib/home/feed-actions-a11y";
import {
  SAVE_PICKER_HINT,
  saveIconButtonAriaLabel,
} from "../src/lib/recollect/save-button-a11y";

function main() {
  assert(
    likeButtonAriaLabel(false, 3) === "いいね（3件）",
    "like label includes count",
  );
  assert(
    likeButtonAriaLabel(true, 1) === "いいね済み（1件）",
    "liked label includes count",
  );
  assert(likeButtonAriaLabel(false, 0) === "いいね", "zero likes omit count");
  assert(likeCountLiveText(2) === "いいね 2件", "live region text");
  assert(likeCountLiveText(0) === "いいねなし", "zero likes live text");

  assert(
    saveIconButtonAriaLabel(false).includes(SAVE_PICKER_HINT),
    "save icon label documents picker shortcut",
  );
  assert(
    saveIconButtonAriaLabel(true).includes("保存済み"),
    "saved icon label",
  );
  assert(
    FEED_PHOTO_CAROUSEL_LABEL.includes("詳細"),
    "carousel label mentions detail activation",
  );

  console.log("PASS: feed action a11y verified");
}

main();
