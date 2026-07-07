/** Friend profile and collection routes (#116, #122). */

import { friendProfilePath as buildFriendProfilePath } from "@/lib/share/paths";

export {
  actorProfilePath,
  collectionPath,
  friendCollectionPath,
  friendProfilePath,
  spotPath,
} from "@/lib/share/paths";

/** Query value for /mypage/friends when opened from the home screen (#156). */
export const FRIENDS_FROM_HOME = "home";

export function friendsPagePath(options?: { from?: typeof FRIENDS_FROM_HOME }): string {
  if (options?.from === FRIENDS_FROM_HOME) {
    return `/mypage/friends?from=${FRIENDS_FROM_HOME}`;
  }
  return "/mypage/friends";
}

export function friendsBackNavigation(fromHome: boolean): {
  href: string;
  ariaLabel: string;
} {
  if (fromHome) {
    return { href: "/", ariaLabel: "ホームに戻る" };
  }
  return { href: "/mypage", ariaLabel: "マイページに戻る" };
}

export function friendProfilePathWithContext(
  userId: string,
  options?: { from?: typeof FRIENDS_FROM_HOME },
): string {
  const base = buildFriendProfilePath(userId);
  if (options?.from === FRIENDS_FROM_HOME) {
    return `${base}?from=${FRIENDS_FROM_HOME}`;
  }
  return base;
}
