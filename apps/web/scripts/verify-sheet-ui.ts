/**
 * Bottom sheet primitive verification (#127).
 * Run via: pnpm exec tsx scripts/verify-sheet-ui.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { assert } from "./test-helpers/assert";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const sheet = readSource("components/ui/sheet.tsx");
assert(sheet.includes("export function Sheet"), "Sheet primitive exported");
assert(sheet.includes("SheetGrabber"), "Sheet grabber exported");
assert(sheet.includes("SheetDragHandle"), "Sheet drag handle exported");
assert(sheet.includes("onPointerDown"), "Sheet supports pointer drag dismiss");
assert(sheet.includes("SHEET_DISMISS_DRAG_PX"), "Sheet defines dismiss threshold");
assert(sheet.includes("SHEET_MOBILE_MEDIA"), "Sheet limits swipe dismiss to mobile viewport");

const globalsCss = readFileSync(join(root, "app/globals.css"), "utf8");
assert(globalsCss.includes(".mogu-sheet-panel"), "sheet panel animation styles exist");
assert(globalsCss.includes("motion-reduce"), "sheet animation respects reduced motion");
assert(globalsCss.includes(".mogu-sheet-dialog::backdrop"), "sheet backdrop fade exists");

const spotDetailSheet = readSource("components/spots/spot-detail-sheet.tsx");
assert(spotDetailSheet.includes("@/components/ui/sheet"), "spot detail uses Sheet primitive");
assert(!spotDetailSheet.includes("<dialog"), "spot detail no longer uses raw dialog");

const collectionPicker = readSource("components/recollect/collection-picker-sheet.tsx");
assert(collectionPicker.includes("SheetHeader"), "collection picker uses Sheet header");
assert(!collectionPicker.includes("<dialog"), "collection picker no longer uses raw dialog");

const consultationSheet = readSource(
  "components/search/agent-consultation-history-sheet.tsx",
);
assert(consultationSheet.includes("Sheet"), "consultation history uses Sheet");
assert(!consultationSheet.includes("<dialog"), "consultation history no longer uses raw dialog");

const feedWrapper = readSource("components/home/feed-spot-detail-sheet.tsx");
assert(feedWrapper.includes("SpotDetailSheet"), "feed detail still routes through SpotDetailSheet");

console.log("PASS: sheet UI verified");
