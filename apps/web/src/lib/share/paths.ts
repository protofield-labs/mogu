/** Canonical deeplink paths (#122). */

export function spotPath(spotId: string): string {
  return `/spots/${encodeURIComponent(spotId)}`;
}

export function collectionPath(collectionId: string): string {
  return `/collections/${encodeURIComponent(collectionId)}`;
}

/** @deprecated Prefer collectionPath — kept for profile links. */
export function friendProfilePath(userId: string): string {
  return `/users/${encodeURIComponent(userId)}`;
}

/** @deprecated Prefer collectionPath. */
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
