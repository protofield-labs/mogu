/** Friend profile and collection routes (#116). */

export function friendProfilePath(userId: string): string {
  return `/users/${encodeURIComponent(userId)}`;
}

export function friendCollectionPath(
  userId: string,
  collectionId: string,
): string {
  return `${friendProfilePath(userId)}/collections/${encodeURIComponent(collectionId)}`;
}

/** Feed actor link: own posts go to mypage, friends go to profile. */
export function actorProfilePath(
  actorId: string,
  viewerId?: string | null,
): string {
  if (viewerId && actorId === viewerId) {
    return "/mypage";
  }
  return friendProfilePath(actorId);
}
