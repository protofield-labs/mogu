import { z } from "zod";

import { recommendationSchema } from "@/lib/api/schemas/home";
import { spotSchema } from "@/lib/api/schemas/spot";
import type { ChatEntry } from "@/lib/agent/chat-helpers";

const userEntrySchema = z.object({
  id: z.string(),
  kind: z.literal("user"),
  text: z.string(),
  chips: z.array(z.string()).optional(),
});

const agentEntrySchema = z.object({
  id: z.string(),
  kind: z.literal("agent"),
  text: z.string(),
  recommendation: recommendationSchema.optional(),
  candidateSpots: z.array(spotSchema).optional(),
  quickReplies: z.array(z.string()).optional(),
  personaKey: z.enum(["ken", "aoi"]).optional(),
});

export const consultationEntriesSchema = z.array(
  z.discriminatedUnion("kind", [userEntrySchema, agentEntrySchema]),
);

export function parseConsultationEntries(value: unknown): ChatEntry[] {
  const parsed = consultationEntriesSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}
