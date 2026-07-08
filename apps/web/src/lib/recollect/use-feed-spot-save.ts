"use client";

import { useState } from "react";

import { useFeedSpotLike } from "@/lib/home/use-feed-spot-like";
import { useRecollect } from "@/lib/recollect/use-recollect";

type UseFeedSpotSaveOptions = {
  initialSaved?: boolean;
  initialLikedByMe?: boolean;
  initialLikeCount?: number;
};

/** Feed card save + like state and detail sheet open state (#112, #212). */
export function useFeedSpotSave(
  spotId: string,
  options: UseFeedSpotSaveOptions = {},
) {
  const recollect = useRecollect(spotId, options);
  const like = useFeedSpotLike(
    spotId,
    options.initialLikedByMe ?? false,
    options.initialLikeCount ?? 0,
  );
  const [detailOpen, setDetailOpen] = useState(false);

  return {
    recollect,
    like,
    detailOpen,
    openDetail: () => setDetailOpen(true),
    closeDetail: () => setDetailOpen(false),
  };
}
