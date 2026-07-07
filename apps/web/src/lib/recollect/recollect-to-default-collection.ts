"use client";

import type { Collection } from "@/lib/collections/browser-api";
import { listMyCollections } from "@/lib/collections/browser-api";
import {
  getLastRecollectTarget,
  type LastRecollectTarget,
} from "@/lib/recollect/last-target";
import { saveSpotToCollection, type SaveSpotResult } from "@/lib/recollect/save-spot";

/** Pick the default collection for picker pre-selection (#112). */
export function pickDefaultCollection(
  collections: Collection[],
  lastTarget: LastRecollectTarget | null = getLastRecollectTarget(),
): Collection | null {
  if (collections.length === 0) {
    return null;
  }

  if (
    lastTarget &&
    collections.some((item) => item.id === lastTarget.collectionId)
  ) {
    return (
      collections.find((item) => item.id === lastTarget.collectionId) ??
      collections[0]!
    );
  }

  return collections[0]!;
}

export type SaveSpotToDefaultCollectionResult =
  | SaveSpotResult
  | { ok: false; needsPicker: true; error?: string };

/**
 * Save using the last target, or the user's first collection when none is stored (#112).
 * Returns needsPicker when no collections exist.
 */
export async function saveSpotToDefaultCollection(
  spotId: string,
): Promise<SaveSpotToDefaultCollectionResult> {
  const lastTarget = getLastRecollectTarget();
  if (lastTarget) {
    return saveSpotToCollection(
      spotId,
      lastTarget.collectionId,
      lastTarget.collectionName,
    );
  }

  let collections: Collection[];
  try {
    collections = await listMyCollections();
  } catch (err) {
    return {
      ok: false,
      needsPicker: true,
      error:
        err instanceof Error
          ? err.message
          : "コレクションを読み込めませんでした",
    };
  }

  const target = pickDefaultCollection(collections, null);
  if (!target) {
    return { ok: false, needsPicker: true };
  }

  return saveSpotToCollection(spotId, target.id, target.name);
}
