import type { FeedItem } from "@/lib/home/types";

/** True when the feed actor is the signed-in viewer (own spot activity). */
export function isOwnFeedItem(
  item: FeedItem,
  viewerId: string | null | undefined,
): boolean {
  return Boolean(viewerId && item.actor.id === viewerId);
}

/** Feed items the viewer may recollect (save) into their collection. */
export function canRecollectFeedItem(
  item: FeedItem,
  viewerId: string | null | undefined,
): boolean {
  return !isOwnFeedItem(item, viewerId);
}
