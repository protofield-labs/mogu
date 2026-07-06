import { z } from "zod";

export const signedUploadBodySchema = z.object({
  contentType: z.string().trim().min(1).max(128),
});

export const signedUploadResponseSchema = z.object({
  uploadUrl: z.string(),
  objectUrl: z.string(),
  objectPath: z.string(),
  contentType: z.string(),
});
