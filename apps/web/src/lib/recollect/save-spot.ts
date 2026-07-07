"use client";

import { recollectSpot } from "@/lib/spots/browser-api";
import { setLastRecollectTarget } from "@/lib/recollect/last-target";

export type SaveSpotResult =
  | { ok: true; collectionId: string; collectionName: string }
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
    return { ok: true, collectionId, collectionName };
  } catch {
    return { ok: false, error: "保存に失敗しました" };
  }
}
