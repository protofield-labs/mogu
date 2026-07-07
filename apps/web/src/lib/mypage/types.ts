export type { MeProfile } from "@/lib/users/types";

export type MeBadges = {
  pendingFriendRequests: number;
  unreadFlags: number;
};

export type FlagNotification = {
  type: "recollected";
  count: number;
  isAnonymous: boolean;
  weekOf: string;
};

export type FriendUser = {
  id: string;
  displayName: string;
  avatarColor: string;
};

export type FriendRequest = {
  pairId: string;
  from: FriendUser;
  to: FriendUser;
  status: "pending" | "accepted";
  createdAt: string;
};
