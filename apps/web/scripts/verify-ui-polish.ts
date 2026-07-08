/**
 * UI polish verification (#232, #227).
 * Run via: pnpm exec tsx scripts/verify-ui-polish.ts
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildEvidence } from "../src/lib/recommendations/pick";
import { Rating } from "@prisma/client";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const bubble = readSource("components/ui/bubble.tsx");
assert(
  !bubble.includes("word-break:auto-phrase"),
  "bubble avoids auto-phrase width shrink on short text",
);
assert(
  !bubble.includes("overflow-wrap:anywhere"),
  "bubble avoids anywhere min-content shrink on short text (#253)",
);
assert(
  bubble.includes("wrap-break-word"),
  "bubble wraps long tokens without shrinking min width",
);

const avatarRow = readSource("components/home/avatar-row.tsx");
assert(
  avatarRow.includes("pt-2"),
  "avatar row reserves top padding for selection ring (#255)",
);
assert(
  avatarRow.includes("line-clamp-2") && avatarRow.includes("break-words"),
  "avatar row shows friend names on up to two lines (#255)",
);
assert(
  !avatarRow.includes("truncate"),
  "avatar row no longer truncates friend names",
);

const mypageView = readSource("components/mypage/mypage-view.tsx");
assert(
  mypageView.includes("whitespace-nowrap"),
  "collection heading stays on one line",
);

const demoSeed = readSource("lib/seed/run-demo-seed.ts");
assert(
  demoSeed.includes("buildEvidence"),
  "demo seed uses current rating labels in evidence",
);
assert(
  !demoSeed.includes("また行きたい"),
  "demo seed drops legacy rating label",
);

assert(
  buildEvidence("Ken", Rating.again, 3).includes("すき"),
  "evidence helper uses new rating label",
);

console.log("PASS: UI polish verified");
