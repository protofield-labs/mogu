import { z } from "zod";

export const ratingSchema = z.enum(["again", "either", "no"]);

export const structuredTagsSchema = z.object({
  area: z.string().trim().max(80).nullable().optional(),
  genre: z.string().trim().max(80).nullable().optional(),
  situation: z.string().trim().max(80).nullable().optional(),
});

export const createSpotBodySchema = z.object({
  placeId: z.string().trim().min(1).max(256),
  comment: z.string().trim().max(500),
  rating: ratingSchema,
  structuredTags: structuredTagsSchema.optional(),
  freeTags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  photoUrls: z.array(z.string().trim().url().max(2048)).max(5).optional(),
});

export const updateSpotBodySchema = z
  .object({
    comment: z.string().trim().max(500).optional(),
    rating: ratingSchema.optional(),
    structuredTags: structuredTagsSchema.optional(),
    freeTags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
    photoUrls: z.array(z.string().trim().url().max(2048)).max(5).optional(),
  })
  .refine((body) => Object.keys(body).length > 0);

export const signedUploadBodySchema = z.object({
  contentType: z.string().trim().min(1).max(128),
});
