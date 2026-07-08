/**
 * Dark mode wiring verification (#129 Definition of Done).
 * Run via: pnpm exec tsx scripts/verify-dark-mode.ts
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), "src", relativePath), "utf8");
}

function main() {
  const packageJson = JSON.parse(
    readFileSync(join(process.cwd(), "package.json"), "utf8"),
  ) as { dependencies?: Record<string, string> };

  assert(
    packageJson.dependencies?.["next-themes"] !== undefined,
    "next-themes dependency installed",
  );

  const themeProvider = readSource("components/theme-provider.tsx");
  assert(themeProvider.includes('attribute="class"'), "theme uses class strategy");
  assert(themeProvider.includes('defaultTheme="system"'), "theme defaults to system");
  assert(themeProvider.includes("enableSystem"), "theme enables system preference");

  const appProviders = readSource("components/app-providers.tsx");
  assert(appProviders.includes("ThemeProvider"), "app providers wrap theme");
  assert(appProviders.includes("ThemeColorSync"), "app providers sync theme-color meta");

  const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
  assert(layout.includes("suppressHydrationWarning"), "layout suppresses theme hydration mismatch");
  assert(
    layout.includes('prefers-color-scheme: light'),
    "layout sets light theme-color",
  );
  assert(
    layout.includes('prefers-color-scheme: dark'),
    "layout sets dark theme-color",
  );

  const globalsCss = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  assert(globalsCss.includes(".dark {"), "globals defines dark tokens");
  assert(
    globalsCss.includes("--mogu-surface:"),
    "dark block defines mogu surface token",
  );
  assert(
    globalsCss.includes("--mogu-surface-elevated:"),
    "dark block defines elevated surface token",
  );
  assert(
    globalsCss.includes("--mogu-avatar-ring-new:"),
    "dark block defines avatar new ring token",
  );
  assert(
    globalsCss.includes("--mogu-badge:"),
    "dark block defines badge token",
  );
  assert(
    /--primary:\s*oklch\([^)]*0\.1[0-9]/m.test(
      globalsCss.slice(globalsCss.indexOf(".dark")),
    ),
    "dark primary keeps warm accent chroma",
  );
  assert(globalsCss.includes("color-scheme: dark"), "dark sets native color-scheme");

  const sonner = readSource("components/ui/sonner.tsx");
  assert(sonner.includes('theme="system"'), "toasts follow system theme");

  console.log("PASS: dark mode wiring verified");
}

main();
