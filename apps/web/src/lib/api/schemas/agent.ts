import { z } from "zod";

import { recommendationSchema } from "@/lib/api/schemas/home";
import { spotSchema } from "@/lib/api/schemas/spot";

export const recommendationContextSchema = z.object({
  placeId: z.string().min(1).max(200),
  spotId: z.string().min(1).max(100),
  assertion: z.string().min(1).max(4000),
  evidence: z.string().min(1).max(4000),
  placeName: z.string().min(1).max(400).optional(),
});

export const collectionContextSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("collection"),
    collectionId: z.string().min(1).max(100),
    collectionName: z.string().min(1).max(200),
  }),
  z.object({
    kind: z.literal("first-spot"),
  }),
]);

export const createAgentSessionBodySchema = z.object({
  recommendationContext: recommendationContextSchema.optional(),
  collectionContext: collectionContextSchema.optional(),
});

export const createAgentSessionResponseSchema = z.object({
  sessionId: z.string(),
});

export const agentMessageSchema = z.object({
  role: z.literal("agent"),
  text: z.string(),
  thinking: z.array(z.string()).optional(),
  recommendation: recommendationSchema.optional(),
  candidateSpots: z.array(spotSchema).optional(),
  quickReplies: z.array(z.string()).optional(),
});

export const placeDtoSchema = z.object({
  placeId: z.string(),
  name: z.string(),
  address: z.string(),
  photos: z.array(
    z.object({
      url: z.string(),
      authorAttributions: z.array(
        z.object({
          name: z.string(),
          uri: z.string(),
        }),
      ),
    }),
  ),
  location: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
  openNow: z.boolean().optional(),
});
