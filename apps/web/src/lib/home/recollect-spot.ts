"use client";

import { listMyCollections } from "@/lib/collections/browser-api";
import { recollectSpot } from "@/lib/agent/browser-api";

export type RecollectResult =
  | { ok: true }
  | { ok: false; error: string };

export async function recollectFeedSpot(spotId: string): Promise<RecollectResult> {
  try {
    const collections = await listMyCollections();
    const targetCollectionId = collections[0]?.id ?? null;
    if (!targetCollectionId) {
      return { ok: false, error: "保存先のコレクションがありません" };
    }
    const saved = await recollectSpot(spotId, targetCollectionId);
    if (!saved) {
      return { ok: false, error: "保存に失敗しました" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "保存に失敗しました" };
  }
}
