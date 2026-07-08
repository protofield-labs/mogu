import type { CSSProperties } from "react";

/** Stagger step for list enter motion (#128). */
export const MOGU_STAGGER_MS = 40;

/** Cap stagger delay so long lists stay snappy. */
export const MOGU_STAGGER_MAX = 12;

/** Shared fade + slide-up enter pattern (tw-animate-css). */
export const moguEnterMotionClass =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 motion-safe:fill-mode-both motion-reduce:animate-none";

export function moguEnterDelayStyle(
  index: number | undefined,
): CSSProperties | undefined {
  if (index === undefined || index <= 0) {
    return undefined;
  }
  const capped = Math.min(index, MOGU_STAGGER_MAX);
  return { animationDelay: `${capped * MOGU_STAGGER_MS}ms` };
}
