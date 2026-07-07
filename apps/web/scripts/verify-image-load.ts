/**
 * Image load UX verification (#126 Definition of Done).
 * Run via: pnpm exec tsx scripts/verify-image-load.ts
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const globalsCss = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
assert(globalsCss.includes("mogu-shimmer"), "globals defines shimmer utility");
assert(globalsCss.includes("prefers-reduced-motion"), "shimmer respects motion reduce");

const authImage = readSource("components/mypage/auth-image.tsx");
assert(authImage.includes("ProgressiveImageFrame"), "auth image uses progressive frame");
assert(authImage.includes("useAuthenticatedImageBlob"), "auth image uses shared blob hook");

const placePhoto = readSource("components/places/place-photo-image.tsx");
assert(placePhoto.includes("ProgressiveImageFrame"), "place photo uses progressive frame");

const frame = readSource("components/ui/progressive-image-frame.tsx");
assert(frame.includes("mogu-shimmer"), "frame shows shimmer while loading");
assert(frame.includes("ImageOff"), "frame shows error fallback icon");
assert(frame.includes("opacity-0"), "frame fades image in");
assert(frame.includes("onError"), "frame handles decode failures");

const skeleton = readSource("components/ui/skeleton.tsx");
assert(skeleton.includes("mogu-shimmer"), "skeleton uses shimmer variant");
assert(!skeleton.includes("animate-pulse"), "skeleton drops pulse-only loading");

console.log("PASS: image load UX verified");
