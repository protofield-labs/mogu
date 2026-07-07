"use client";

import { recollectSpot } from "@/lib/agent/browser-api";
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
    const savedSpot = await recollectSpot(spotId, collectionId);
    if (!savedSpot) {
      return { ok: false, error: "保存に失敗しました" };
    }
    if (savedSpot.collectionId !== collectionId) {
      return { ok: false, error: "既に別の棚に保存済みです" };
    }
    setLastRecollectTarget({ collectionId, collectionName });
    return { ok: true, collectionId, collectionName };
  } catch {
    return { ok: false, error: "保存に失敗しました" };
  }
}
