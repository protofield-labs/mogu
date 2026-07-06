import { z } from "zod";

import { spotSchema } from "@/lib/api/schemas/spot";

export const collectionVisibilitySchema = z.enum(["friends", "secret"]);

export const collectionSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  coverUrl: z.string().nullable(),
  visibility: collectionVisibilitySchema,
  theme: z.string().nullable(),
  spotCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const collectionDetailSchema = collectionSchema.extend({
  spots: z.array(spotSchema),
});

export const createCollectionBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240).optional(),
  visibility: collectionVisibilitySchema,
  theme: z.string().trim().max(80).optional(),
});

export const updateCollectionBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(240).nullable().optional(),
    coverUrl: z.string().trim().url().max(2048).nullable().optional(),
    visibility: collectionVisibilitySchema.optional(),
    theme: z.string().trim().max(80).nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0);
