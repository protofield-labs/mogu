/**
 * Design token verification (#90 Definition of Done).
 * Run via: pnpm exec tsx scripts/verify-design-tokens.ts
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { showRecollectSuccessToast } from "../src/lib/ui/recollect-toast";

function main() {
  const globalsCss = readFileSync(
    join(process.cwd(), "src/app/globals.css"),
    "utf8",
  );
  const layoutTsx = readFileSync(
    join(process.cwd(), "src/app/layout.tsx"),
    "utf8",
  );

  assert(
    /--primary:\s*oklch\([^)]*0\.1[0-9]/m.test(globalsCss),
    "primary uses warm accent chroma",
  );
  assert(
    globalsCss.includes("--font-noto-sans-jp"),
    "font stack includes Noto Sans JP",
  );
  assert(
    layoutTsx.includes("Noto_Sans_JP"),
    "layout loads Noto Sans JP",
  );
  assert(
    layoutTsx.includes("preload: false"),
    "Noto Sans JP disables preload for CJK glyphs",
  );
  assert(
    globalsCss.includes(".mogu-elevated"),
    "elevated surface utility exists",
  );
  assert(
    globalsCss.includes("--text-caption"),
    "text-caption token registered",
  );
  assert(
    typeof showRecollectSuccessToast === "function",
    "recollect toast helper exported",
  );

  console.log("PASS: design tokens verified");
}

main();
