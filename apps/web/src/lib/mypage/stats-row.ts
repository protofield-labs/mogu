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
    collectionsLabel: `${counts.collections} 棚`,
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
