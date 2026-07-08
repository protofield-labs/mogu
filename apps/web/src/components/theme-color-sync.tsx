"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

export const MOGU_LIGHT_THEME_COLOR = "#F5F2ED";
export const MOGU_DARK_THEME_COLOR = "#2A2724";

/** Keep `<meta name="theme-color">` aligned with resolved app theme (#129). */
export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!resolvedTheme) {
      return;
    }

    const color =
      resolvedTheme === "dark"
        ? MOGU_DARK_THEME_COLOR
        : MOGU_LIGHT_THEME_COLOR;

    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
      meta.setAttribute("content", color);
    }
  }, [resolvedTheme]);

  return null;
}
