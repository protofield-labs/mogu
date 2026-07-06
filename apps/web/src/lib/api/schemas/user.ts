import { z } from "zod";

export const userSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  avatarColor: z.string(),
});

export const meProfileSchema = userSchema.extend({
  counts: z.object({
    collections: z.number(),
    spots: z.number(),
    friends: z.number(),
  }),
});

export const meBadgesSchema = z.object({
  pendingFriendRequests: z.number(),
  unreadFlags: z.number(),
});

export const friendUserSchema = userSchema;

export const friendRequestSchema = z.object({
  pairId: z.string(),
  from: friendUserSchema,
  to: friendUserSchema,
  status: z.enum(["pending", "accepted"]),
  createdAt: z.string(),
});
