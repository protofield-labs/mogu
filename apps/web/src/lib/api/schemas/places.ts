import { z } from "zod";

export const placeSearchResultSchema = z.object({
  placeId: z.string(),
  name: z.string(),
  address: z.string(),
  openNow: z.boolean().optional(),
});

export const placeSearchResultListSchema = z.array(placeSearchResultSchema);
