import { z } from "zod";

import {
  friendRequestSchema,
  friendUserSchema,
  meBadgesSchema,
} from "@/lib/api/schemas/user";

export const friendUserListSchema = z.array(friendUserSchema);
export const friendRequestListSchema = z.array(friendRequestSchema);

export const flagNotificationSchema = z.object({
  type: z.literal("recollected"),
  count: z.number(),
  isAnonymous: z.boolean(),
  weekOf: z.string(),
});

export const flagNotificationListSchema = z.array(flagNotificationSchema);

export const flagEventSchema = z.object({
  id: z.string().uuid(),
  spotId: z.string().uuid().nullable(),
  collectionId: z.string().uuid().nullable(),
  placeId: z.string().nullable(),
  spotComment: z.string().nullable(),
  actor: friendUserSchema.nullable(),
  isAnonymous: z.boolean(),
  createdAt: z.string(),
});

export const flagEventListSchema = z.array(flagEventSchema);

export const flagsReadResponseSchema = z.object({
  updated: z.number(),
});

export { meBadgesSchema };
