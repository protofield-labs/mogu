"use client";

import type { Recommendation } from "@/lib/agent/types";
import { clearPendingCollectionConsult } from "@/lib/mypage/pending-collection-consult";

const PENDING_RECOMMENDATION_KEY = "mogu:pending-recommendation";

/** Survives AgentChat remount until commitPendingRecommendation (#240). */
let bridgedPendingRecommendation: Recommendation | undefined;

export function stashPendingRecommendation(recommendation: Recommendation): void {
  clearPendingCollectionConsult();
  sessionStorage.setItem(PENDING_RECOMMENDATION_KEY, JSON.stringify(recommendation));
  // Keep bridge aligned so a new consult CTA overrides a stale in-memory value (#240).
  bridgedPendingRecommendation = recommendation;
}

export function clearPendingRecommendation(): void {
  sessionStorage.removeItem(PENDING_RECOMMENDATION_KEY);
  bridgedPendingRecommendation = undefined;
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

/**
 * Resolve stashed recommendation for agent connect. Peeks sessionStorage and
 * holds the value in memory so a remounted AgentChat can still apply context.
 */
export function resolvePendingRecommendation(): Recommendation | null {
  if (bridgedPendingRecommendation !== undefined) {
    return bridgedPendingRecommendation;
  }
  const fromStorage = peekPendingRecommendation();
  if (fromStorage) {
    bridgedPendingRecommendation = fromStorage;
  }
  return fromStorage;
}

/** Call after pending context is applied to a live agent session. */
export function commitPendingRecommendation(): void {
  clearPendingRecommendation();
}

/** @deprecated Prefer resolvePendingRecommendation + commitPendingRecommendation. */
export function consumePendingRecommendation(): Recommendation | null {
  const recommendation = resolvePendingRecommendation();
  if (recommendation) {
    commitPendingRecommendation();
  }
  return recommendation;
}
