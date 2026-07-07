import { z } from "zod";

export { uuidRouteParamsSchema } from "@/lib/api/schemas/common";

export const pairIdRouteParamsSchema = z.object({
  pairId: z.string().trim().min(1).max(512),
});

export const feedQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(2048).optional(),
});

export const collectionsListQuerySchema = z.object({
  ownerId: z.string().trim().min(1).max(128).optional(),
});

export const userSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
});

export const userIdRouteParamsSchema = z.object({
  id: z.string().trim().min(1).max(128),
});

export const friendRequestsQuerySchema = z.object({
  box: z.enum(["in", "out"]),
});

export const provisionBodySchema = z.object({
  displayName: z.string().trim().min(1).max(100),
});

export const readFlagsBodySchema = z.object({
  ids: z.array(z.string().uuid()).optional(),
});

export const recollectBodySchema = z.object({
  targetCollectionId: z.string().uuid(),
});

export function resolveCollectionsOwnerId(
  ownerId: string | undefined,
  uid: string,
): string {
  return !ownerId || ownerId === "me" ? uid : ownerId;
}
