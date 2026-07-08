/**
 * PWA manifest verification (#87 Definition of Done).
 * Run via: pnpm exec tsx scripts/verify-pwa-manifest.ts
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

function main() {
  const publicDir = join(process.cwd(), "public");
  const manifest = JSON.parse(
    readFileSync(join(publicDir, "manifest.webmanifest"), "utf8"),
  ) as {
    display?: string;
    start_url?: string;
    theme_color?: string;
    background_color?: string;
    icons?: Array<{ src: string; sizes: string }>;
  };
  const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");

  assert(manifest.display === "standalone", "manifest uses standalone display");
  assert(manifest.start_url === "/", "manifest start_url is /");
  assert(
    manifest.icons?.some((icon) => icon.sizes === "192x192") === true,
    "manifest includes 192 icon",
  );
  assert(
    manifest.icons?.some((icon) => icon.sizes === "512x512") === true,
    "manifest includes 512 icon",
  );

  for (const file of [
    "icons/icon-192.png",
    "icons/icon-512.png",
    "icons/apple-touch-icon.png",
  ]) {
    readFileSync(join(publicDir, file));
  }

  assert(layout.includes("/manifest.webmanifest"), "layout links manifest");
  assert(layout.includes("themeColor"), "layout sets themeColor");
  assert(
    layout.includes("prefers-color-scheme: light"),
    "layout themeColor respects light scheme",
  );
  assert(
    layout.includes("prefers-color-scheme: dark"),
    "layout themeColor respects dark scheme",
  );
  assert(
    manifest.theme_color === "#F5F2ED",
    "manifest theme_color matches light surface",
  );
  assert(
    manifest.background_color === "#F5F2ED",
    "manifest background_color matches light surface",
  );
  assert(
    !readFileSync(
      join(process.cwd(), "src/components/mypage/mypage-view.tsx"),
      "utf8",
    ).includes("window.confirm"),
    "mypage delete uses in-app dialog",
  );
  assert(
    !readFileSync(
      join(process.cwd(), "src/components/mypage/collection-detail-view.tsx"),
      "utf8",
    ).includes("window.confirm"),
    "collection detail delete uses in-app dialog",
  );

  console.log("PASS: PWA manifest and delete dialogs verified");
}

main();
