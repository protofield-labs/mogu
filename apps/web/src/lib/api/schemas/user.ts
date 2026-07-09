import { z } from "zod";

export const userSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  avatarColor: z.string(),
  avatarUrl: z.string().nullable(),
});

export const meProfileSchema = userSchema.extend({
  counts: z.object({
    collections: z.number(),
    spots: z.number(),
    friends: z.number(),
  }),
});

export const friendProfileSchema = userSchema.extend({
  counts: z.object({
    collections: z.number(),
    spots: z.number(),
  }),
});

export const meBadgesSchema = z.object({
  pendingFriendRequests: z.number(),
  unreadFlags: z.number(),
});

export const friendUserSchema = userSchema;

export const friendListItemSchema = userSchema.extend({
  collectionCount: z.number().int().nonnegative(),
});

export const friendRequestSchema = z.object({
  pairId: z.string(),
  from: friendUserSchema,
  to: friendUserSchema,
  status: z.enum(["pending", "accepted"]),
  createdAt: z.string(),
});
