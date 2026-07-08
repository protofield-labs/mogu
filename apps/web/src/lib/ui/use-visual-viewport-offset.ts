"use client";

import { useEffect, useState } from "react";

/**
 * Keyboard overlap offset for fixed footers (iOS Safari visualViewport; #128).
 */
export function useVisualViewportOffset() {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }

    function update() {
      if (!viewport) {
        return;
      }
      const gap =
        window.innerHeight - viewport.height - viewport.offsetTop;
      setOffset(Math.max(0, Math.round(gap)));
    }

    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    update();

    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return offset;
}
