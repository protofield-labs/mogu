import type { FlagEvent } from "@/lib/mypage/types";

export function formatFlagEventMessage(event: Pick<FlagEvent, "actor" | "isAnonymous">): string {
  if (event.isAnonymous || !event.actor) {
    return "誰かがあなたのスポットを保存しました";
  }
  return `${event.actor.displayName}さんがあなたのスポットを保存しました`;
}

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) {
    return "たった今";
  }

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) {
    return "たった今";
  }
  if (minutes < 60) {
    return `${minutes}分前`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}時間前`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}日前`;
  }

  return then.toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
  });
}

export function flagEventHref(event: FlagEvent): string | null {
  if (!event.collectionId || !event.spotId) {
    return null;
  }
  const params = new URLSearchParams({ spotId: event.spotId });
  return `/mypage/collections/${event.collectionId}?${params.toString()}`;
}
