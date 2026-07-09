"use client";

import { recollectSpot, unrecollectSpot } from "@/lib/spots/browser-api";
import { setLastRecollectTarget } from "@/lib/recollect/last-target";

export type SaveSpotResult =
  | {
      ok: true;
      collectionId: string;
      collectionName: string;
      /** Refreshed place-level circle count from the created copy (erd-api §5). */
      savedCount: number;
    }
  | { ok: false; error: string };

export async function saveSpotToCollection(
  spotId: string,
  collectionId: string,
  collectionName: string,
): Promise<SaveSpotResult> {
  try {
    const result = await recollectSpot(spotId, collectionId);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    if (result.spot.collectionId !== collectionId) {
      return { ok: false, error: "既に別のコレクションに保存済みです" };
    }
    setLastRecollectTarget({ collectionId, collectionName });
    return {
      ok: true,
      collectionId,
      collectionName,
      savedCount: result.spot.savedCount,
    };
  } catch {
    return { ok: false, error: "保存に失敗しました" };
  }
}

export type UnsaveSpotResult =
  | { ok: true; savedCount: number | null }
  | { ok: false; error: string };

/** Undo a recollection of the given source spot (#283). */
export async function unsaveSpot(spotId: string): Promise<UnsaveSpotResult> {
  try {
    const result = await unrecollectSpot(spotId);
    return { ok: true, savedCount: result.savedCount };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "保存を解除できませんでした",
    };
  }
}
