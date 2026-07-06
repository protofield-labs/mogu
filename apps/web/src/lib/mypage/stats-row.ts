export type MeCounts = {
  collections: number;
  spots: number;
  friends: number;
};

export function formatStatsRow(counts: MeCounts): {
  collectionsLabel: string;
  spotsLabel: string;
  friendsLabel: string;
} {
  return {
    collectionsLabel: `${counts.collections} コレクション`,
    spotsLabel: `${counts.spots} スポット`,
    friendsLabel: `${counts.friends} 友達`,
  };
}

export function shouldShowFriendRequestBadge(pendingFriendRequests: number): boolean {
  return pendingFriendRequests > 0;
}

export function shouldShowMypageTabBadge(badges: {
  pendingFriendRequests: number;
  unreadFlags: number;
}): boolean {
  return badges.pendingFriendRequests > 0 || badges.unreadFlags > 0;
}

/** Home bell tap target: friend requests first, then flag inbox on mypage (#82). */
export function getNotificationHref(badges: {
  pendingFriendRequests: number;
  unreadFlags: number;
}): "/mypage/friends" | "/mypage" {
  if (badges.pendingFriendRequests > 0) {
    return "/mypage/friends";
  }
  return "/mypage";
}
