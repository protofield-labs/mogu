import { z } from "zod";

export const shareGateSchema = z.object({
  ownerId: z.string(),
  ownerDisplayName: z.string(),
  collectionName: z.string(),
});

export const userShareGateSchema = z.object({
  ownerId: z.string(),
  ownerDisplayName: z.string(),
});
