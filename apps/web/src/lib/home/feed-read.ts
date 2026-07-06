import type { FeedItem } from "@/lib/home/types";
import type { FriendUser } from "@/lib/mypage/types";

export const LAST_READ_FEED_AT_KEY = "mogu:lastReadFeedAt";

export function getLastReadFeedAt(): Date | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(LAST_READ_FEED_AT_KEY);
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function markFeedRead(at: Date = new Date()): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(LAST_READ_FEED_AT_KEY, at.toISOString());
}

export function clearLastReadFeedAt(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(LAST_READ_FEED_AT_KEY);
}

export function isFeedItemUnread(
  createdAt: string,
  lastReadAt: Date | null,
): boolean {
  if (!lastReadAt) {
    return true;
  }
  return new Date(createdAt).getTime() > lastReadAt.getTime();
}

export function friendHasUnreadFeed(
  friendId: string,
  feedItems: FeedItem[],
  lastReadAt: Date | null,
): boolean {
  return feedItems.some(
    (item) =>
      item.actor.id === friendId && isFeedItemUnread(item.createdAt, lastReadAt),
  );
}

/** Oldest createdAt among loaded items (ms). Infinity when empty. */
export function oldestFeedItemTime(feedItems: FeedItem[]): number {
  return feedItems.reduce(
    (oldest, item) => Math.min(oldest, new Date(item.createdAt).getTime()),
    Number.POSITIVE_INFINITY,
  );
}

function latestFeedTimeForFriend(
  friendId: string,
  feedItems: FeedItem[],
): number {
  return feedItems
    .filter((item) => item.actor.id === friendId)
    .reduce((latest, item) => {
      const time = new Date(item.createdAt).getTime();
      return time > latest ? time : latest;
    }, 0);
}

/** Friends with unread feed activity first, then by latest feed activity. */
export function sortFriendsForAvatarRow(
  friends: FriendUser[],
  feedItems: FeedItem[],
  lastReadAt: Date | null,
): FriendUser[] {
  return [...friends].sort((a, b) => {
    const aUnread = friendHasUnreadFeed(a.id, feedItems, lastReadAt);
    const bUnread = friendHasUnreadFeed(b.id, feedItems, lastReadAt);
    if (aUnread !== bUnread) {
      return aUnread ? -1 : 1;
    }
    const aLatest = latestFeedTimeForFriend(a.id, feedItems);
    const bLatest = latestFeedTimeForFriend(b.id, feedItems);
    if (aLatest !== bLatest) {
      return bLatest - aLatest;
    }
    return a.displayName.localeCompare(b.displayName, "ja");
  });
}

export function shouldShowSoloEmptyState(friendCount: number): boolean {
  return friendCount === 0;
}
