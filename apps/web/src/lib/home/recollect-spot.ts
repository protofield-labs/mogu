"use client";

import { listMyCollections } from "@/lib/collections/browser-api";
import { recollectSpot } from "@/lib/agent/browser-api";

export type RecollectResult =
  | { ok: true; collectionName: string }
  | { ok: false; error: string };

export async function recollectFeedSpot(spotId: string): Promise<RecollectResult> {
  try {
    const collections = await listMyCollections();
    const target = collections[0] ?? null;
    if (!target) {
      return { ok: false, error: "保存先のコレクションがありません" };
    }
    const saved = await recollectSpot(spotId, target.id);
    if (!saved) {
      return { ok: false, error: "保存に失敗しました" };
    }
    return { ok: true, collectionName: target.name };
  } catch {
    return { ok: false, error: "保存に失敗しました" };
  }
}
