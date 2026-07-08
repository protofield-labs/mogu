"use client";

import type { CollectionConsultContext } from "@/lib/agent/collection-context-message";
import { clearPendingRecommendation } from "@/lib/home/pending-recommendation";

const PENDING_COLLECTION_CONSULT_KEY = "mogu:pending-collection-consult";

/** Survives AgentChat remount until commitPendingCollectionConsult (#239). */
let bridgedPendingCollectionConsult: CollectionConsultContext | undefined;

export function stashPendingCollectionConsult(
  context: CollectionConsultContext,
): void {
  clearPendingRecommendation();
  sessionStorage.setItem(PENDING_COLLECTION_CONSULT_KEY, JSON.stringify(context));
  bridgedPendingCollectionConsult = context;
}

export function clearPendingCollectionConsult(): void {
  sessionStorage.removeItem(PENDING_COLLECTION_CONSULT_KEY);
  bridgedPendingCollectionConsult = undefined;
}

function peekPendingCollectionConsult(): CollectionConsultContext | null {
  const raw = sessionStorage.getItem(PENDING_COLLECTION_CONSULT_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as CollectionConsultContext;
  } catch {
    return null;
  }
}

/** Resolve stashed collection consult for agent connect without clearing storage. */
export function resolvePendingCollectionConsult(): CollectionConsultContext | null {
  if (bridgedPendingCollectionConsult !== undefined) {
    return bridgedPendingCollectionConsult;
  }
  const fromStorage = peekPendingCollectionConsult();
  if (fromStorage) {
    bridgedPendingCollectionConsult = fromStorage;
  }
  return fromStorage;
}

/** Call after pending context is applied to a live agent session. */
export function commitPendingCollectionConsult(): void {
  clearPendingCollectionConsult();
}
