"use client";

import type { Recommendation } from "@/lib/agent/types";

const PENDING_RECOMMENDATION_KEY = "mogu:pending-recommendation";

export function stashPendingRecommendation(recommendation: Recommendation): void {
  sessionStorage.setItem(PENDING_RECOMMENDATION_KEY, JSON.stringify(recommendation));
}

export function clearPendingRecommendation(): void {
  sessionStorage.removeItem(PENDING_RECOMMENDATION_KEY);
}

export function consumePendingRecommendation(): Recommendation | null {
  const recommendation = peekPendingRecommendation();
  if (recommendation) {
    clearPendingRecommendation();
  }
  return recommendation;
}

export function peekPendingRecommendation(): Recommendation | null {
  const raw = sessionStorage.getItem(PENDING_RECOMMENDATION_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as Recommendation;
  } catch {
    return null;
  }
}
