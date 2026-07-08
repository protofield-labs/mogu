import { z } from "zod";

import { spotSchema } from "@/lib/api/schemas/spot";
import { friendUserSchema } from "@/lib/api/schemas/user";

export const feedItemSchema = z.object({
  spot: spotSchema,
  actor: friendUserSchema,
  collectionName: z.string(),
  createdAt: z.string(),
  savedByMe: z.boolean(),
  savedSavers: z.array(friendUserSchema),
});

export const feedPageSchema = z.object({
  items: z.array(feedItemSchema),
  nextCursor: z.string().nullable(),
});

export const recommendationSchema = z.object({
  spot: spotSchema,
  assertion: z.string(),
  evidence: z.string(),
  alternatives: z.array(spotSchema),
  savedByMe: z.boolean(),
});
