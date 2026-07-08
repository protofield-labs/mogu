"use client";

import { useCallback, useState } from "react";

import { apiVoid } from "@/lib/api/browser-client";

/** Optimistic like toggle for feed cards (#212). */
export function useFeedSpotLike(
  spotId: string,
  initialLikedByMe: boolean,
  initialLikeCount: number,
) {
  const [likedByMe, setLikedByMe] = useState(initialLikedByMe);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleLike = useCallback(async () => {
    if (busy) {
      return;
    }

    const nextLiked = !likedByMe;
    const previousLiked = likedByMe;
    const previousCount = likeCount;

    setLikedByMe(nextLiked);
    setLikeCount((current) =>
      nextLiked ? current + 1 : Math.max(0, current - 1),
    );
    setError(null);
    setBusy(true);

    try {
      await apiVoid(
        `/api/v1/spots/${spotId}/like`,
        nextLiked ? "いいねできませんでした" : "いいねを解除できませんでした",
        { method: nextLiked ? "POST" : "DELETE" },
      );
    } catch (err) {
      setLikedByMe(previousLiked);
      setLikeCount(previousCount);
      setError(err instanceof Error ? err.message : "いいねを更新できませんでした");
    } finally {
      setBusy(false);
    }
  }, [busy, likeCount, likedByMe, spotId]);

  return {
    likedByMe,
    likeCount,
    busy,
    error,
    toggleLike,
  };
}
