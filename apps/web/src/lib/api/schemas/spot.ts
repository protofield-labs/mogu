import { z } from "zod";

export const ratingSchema = z.enum(["again", "either", "no"]);

export const spotStructuredTagsSchema = z.object({
  area: z.string().nullable(),
  genre: z.string().nullable(),
  situation: z.string().nullable(),
});

export const spotSchema = z.object({
  id: z.string(),
  placeId: z.string(),
  addedBy: z.string(),
  collectionId: z.string(),
  photoUrls: z.array(z.string()),
  comment: z.string(),
  rating: ratingSchema,
  structuredTags: spotStructuredTagsSchema,
  freeTags: z.array(z.string()),
  savedCount: z.number(),
  originUserId: z.string().nullable(),
  createdAt: z.string(),
});
