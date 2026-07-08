import type { KeyboardEvent } from "react";

/** Arrow keys scroll a horizontal overflow container; Enter/Space optionally activate (#237). */
export function handleHorizontalCarouselKeyDown(
  event: KeyboardEvent<HTMLElement>,
  options?: { onActivate?: () => void },
): void {
  const target = event.currentTarget;

  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    const delta =
      event.key === "ArrowLeft" ? -target.clientWidth : target.clientWidth;
    target.scrollBy({ left: delta, behavior: "smooth" });
    return;
  }

  if (
    options?.onActivate &&
    (event.key === "Enter" || event.key === " ")
  ) {
    event.preventDefault();
    options.onActivate();
  }
}
