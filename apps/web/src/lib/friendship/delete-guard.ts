export type FriendshipDeleteGuard = {
  status: "pending" | "accepted";
  mustBeRequester?: boolean;
  mustNotBeRequester?: boolean;
};

export type FriendshipDeleteFailureReason =
  | "not_found"
  | "forbidden"
  | "conflict";

type FriendshipDeleteRow = {
  status: "pending" | "accepted";
  requestedBy: string;
};

/** Classify why deleteMany removed zero rows (for tests and post-delete checks). */
export function classifyFriendshipDeleteFailure(
  friendship: FriendshipDeleteRow | null,
  uid: string,
  guard: FriendshipDeleteGuard,
): FriendshipDeleteFailureReason {
  if (!friendship) {
    return "not_found";
  }
  if (guard.mustBeRequester && friendship.requestedBy !== uid) {
    return "forbidden";
  }
  if (guard.mustNotBeRequester && friendship.requestedBy === uid) {
    return "forbidden";
  }
  if (friendship.status !== guard.status) {
    return "conflict";
  }
  return "conflict";
}
