"use client";

import type { Recommendation } from "@/lib/agent/types";

const PENDING_RECOMMENDATION_KEY = "mogu:pending-recommendation";

export function stashPendingRecommendation(recommendation: Recommendation): void {
  sessionStorage.setItem(PENDING_RECOMMENDATION_KEY, JSON.stringify(recommendation));
}

export function consumePendingRecommendation(): Recommendation | null {
  const raw = sessionStorage.getItem(PENDING_RECOMMENDATION_KEY);
  if (!raw) {
    return null;
  }
  sessionStorage.removeItem(PENDING_RECOMMENDATION_KEY);
  try {
    return JSON.parse(raw) as Recommendation;
  } catch {
    return null;
  }
}
