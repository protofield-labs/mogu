/**
 * UI primitive layer verification (#124).
 * Run via: pnpm exec tsx scripts/verify-ui-primitives.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { assert } from "./test-helpers/assert";

const uiDir = join(process.cwd(), "src/components/ui");
const required = [
  "input.tsx",
  "textarea.tsx",
  "label.tsx",
  "badge.tsx",
  "card.tsx",
  "avatar.tsx",
  "spinner.tsx",
  "empty-state.tsx",
];

for (const file of required) {
  assert(existsSync(join(uiDir, file)), `${file} exists`);
}

const globalsCss = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
assert(globalsCss.includes("--text-caption"), "text-caption token registered");

const buttonSource = readFileSync(join(uiDir, "button.tsx"), "utf8");
assert(buttonSource.includes('cta: "h-11 w-full'), "Button cta size exists");

const avatarSource = readFileSync(join(uiDir, "avatar.tsx"), "utf8");
assert(avatarSource.includes("showNewRing"), "Avatar supports new ring");

const loginSource = readFileSync(
  join(process.cwd(), "src/app/login/page.tsx"),
  "utf8",
);
assert(loginSource.includes('size="cta"'), "login page uses Button cta");
assert(!loginSource.includes("LoaderCircleIcon"), "login page uses Spinner primitive");

const friendsSource = readFileSync(
  join(process.cwd(), "src/components/mypage/friends-view.tsx"),
  "utf8",
);
assert(friendsSource.includes("@/components/ui/avatar"), "friends view uses shared Avatar");
assert(!friendsSource.includes("function UserAvatar"), "friends local avatar removed");

console.log("PASS: UI primitive layer verified");
