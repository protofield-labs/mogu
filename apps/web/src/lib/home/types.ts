import type { Recommendation, Spot } from "@/lib/agent/types";
import type { FriendUser } from "@/lib/mypage/types";

export type FeedItem = {
  spot: Spot;
  actor: FriendUser;
  collectionName: string;
  createdAt: string;
  savedByMe: boolean;
};

export type FeedPage = {
  items: FeedItem[];
  nextCursor: string | null;
};

export type { Recommendation, Spot };
