/**
 * PWA manifest verification (#87 Definition of Done).
 * Run via: pnpm exec tsx scripts/verify-pwa-manifest.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  const publicDir = join(process.cwd(), "public");
  const manifest = JSON.parse(
    readFileSync(join(publicDir, "manifest.webmanifest"), "utf8"),
  ) as {
    display?: string;
    start_url?: string;
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
