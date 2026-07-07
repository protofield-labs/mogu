import { z } from "zod";

export const placeLocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const placeSearchResultSchema = z.object({
  placeId: z.string(),
  name: z.string(),
  address: z.string(),
  openNow: z.boolean().optional(),
});

export const placeSearchResultListSchema = z.array(placeSearchResultSchema);

export const placeLocationDtoSchema = z.object({
  placeId: z.string(),
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
});

export const placeLocationListSchema = z.array(placeLocationDtoSchema);

export const placeLocationsRequestSchema = z.object({
  placeIds: z.array(z.string().min(1)).min(1).max(50),
});
