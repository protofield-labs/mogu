"use client";

import { useCallback, useRef } from "react";

/** Tracks connect/resume generations so stale async work can bail out (#335). */
export function useConnectGeneration() {
  const generationRef = useRef(0);

  const bumpGeneration = useCallback(() => {
    return ++generationRef.current;
  }, []);

  const isStale = useCallback((generation: number) => {
    return generation !== generationRef.current;
  }, []);

  const isCurrent = useCallback((generation: number) => {
    return generation === generationRef.current;
  }, []);

  return { generationRef, bumpGeneration, isStale, isCurrent };
}

export type ConnectGeneration = ReturnType<typeof useConnectGeneration>;
