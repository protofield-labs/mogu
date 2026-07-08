import { z } from "zod";

import { recommendationSchema } from "@/lib/api/schemas/home";

export const recommendationContextSchema = z.object({
  placeId: z.string().min(1),
  spotId: z.string().min(1),
  assertion: z.string().min(1),
  evidence: z.string().min(1),
});

export const createAgentSessionBodySchema = z.object({
  recommendationContext: recommendationContextSchema.optional(),
});

export const createAgentSessionResponseSchema = z.object({
  sessionId: z.string(),
});

export const agentMessageSchema = z.object({
  role: z.literal("agent"),
  text: z.string(),
  thinking: z.array(z.string()).optional(),
  recommendation: recommendationSchema.optional(),
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
