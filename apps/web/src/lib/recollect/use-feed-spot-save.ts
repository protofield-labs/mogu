"use client";

import { useState } from "react";

import { useRecollect } from "@/lib/recollect/use-recollect";

type UseFeedSpotSaveOptions = {
  initialSaved?: boolean;
};

/** Feed card save state: recollect hook + detail sheet open state (#112). */
export function useFeedSpotSave(
  spotId: string,
  options: UseFeedSpotSaveOptions = {},
) {
  const recollect = useRecollect(spotId, options);
  const [detailOpen, setDetailOpen] = useState(false);

  return {
    recollect,
    detailOpen,
    openDetail: () => setDetailOpen(true),
    closeDetail: () => setDetailOpen(false),
  };
}
