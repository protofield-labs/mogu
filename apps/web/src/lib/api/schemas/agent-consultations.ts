import { z } from "zod";

import { consultationEntriesSchema } from "@/lib/agent/consultation-entries";

export const agentConsultationSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const agentConsultationSummaryListSchema = z.array(
  agentConsultationSummarySchema,
);

export const agentConsultationDetailSchema = agentConsultationSummarySchema.extend({
  vertexSessionId: z.string(),
  entries: consultationEntriesSchema,
  resumable: z.boolean(),
});

export const syncAgentConsultationBodySchema = z.object({
  sessionId: z.string().regex(/^\d{1,32}$/),
  entries: consultationEntriesSchema,
});
