import "server-only";

import {
  createAgentEntry,
  createUserEntry,
  type ChatEntry,
} from "@/lib/agent/chat-helpers";
import { parseConsultationEntries } from "@/lib/agent/consultation-entries";
import { buildConsultationTitle } from "@/lib/agent/consultation-title";
import type { AgentMessage } from "@/lib/agent/types";
import { withAuthRls } from "@/lib/auth/with-auth-rls";

export const AGENT_CONSULTATION_LIST_LIMIT = 20;

export type AgentConsultationSummaryDto = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type AgentConsultationDetailDto = AgentConsultationSummaryDto & {
  vertexSessionId: string;
  entries: ChatEntry[];
  resumable: boolean;
};

export async function createAgentConsultation(
  uid: string,
  vertexSessionId: string,
): Promise<void> {
  await withAuthRls(uid, async (tx) => {
    await tx.agentConsultation.create({
      data: {
        userId: uid,
        vertexSessionId,
        title: "新しい相談",
        entries: [],
      },
    });
  });
}

export async function syncAgentConsultationEntries(
  uid: string,
  vertexSessionId: string,
  entries: ChatEntry[],
): Promise<void> {
  await withAuthRls(uid, async (tx) => {
    const row = await tx.agentConsultation.findFirst({
      where: { userId: uid, vertexSessionId },
      select: { id: true, entries: true },
    });
    if (!row) {
      return;
    }

    const existing = parseConsultationEntries(row.entries);
    // Avoid overwriting a newer append with a stale client snapshot (#207).
    if (existing.length > entries.length) {
      return;
    }

    await tx.agentConsultation.update({
      where: { id: row.id },
      data: {
        entries,
        title: buildConsultationTitle(entries),
      },
    });
  });
}

export async function appendAgentConsultationTurn(
  uid: string,
  vertexSessionId: string,
  text: string,
  chips: string[] | undefined,
  agentMessage: AgentMessage,
): Promise<void> {
  await withAuthRls(uid, async (tx) => {
    const row = await tx.agentConsultation.findFirst({
      where: { userId: uid, vertexSessionId },
      select: { id: true, userId: true, entries: true },
    });
    if (!row || row.userId !== uid) {
      return;
    }

    const existing = parseConsultationEntries(row.entries);
    const nextEntries: ChatEntry[] = [
      ...existing,
      createUserEntry(text, chips),
      createAgentEntry({
        text: agentMessage.text,
        recommendation: agentMessage.recommendation,
        quickReplies: agentMessage.quickReplies,
      }),
    ];

    await tx.agentConsultation.update({
      where: { id: row.id },
      data: {
        entries: nextEntries,
        title: buildConsultationTitle(nextEntries),
      },
    });
  });
}

export async function listAgentConsultations(
  uid: string,
): Promise<AgentConsultationSummaryDto[]> {
  return withAuthRls(uid, async (tx) => {
    const rows = await tx.agentConsultation.findMany({
      where: { userId: uid },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: AGENT_CONSULTATION_LIST_LIMIT,
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  });
}

export async function getAgentConsultation(
  uid: string,
  id: string,
): Promise<Omit<AgentConsultationDetailDto, "resumable"> | null> {
  return withAuthRls(uid, async (tx) => {
    const row = await tx.agentConsultation.findFirst({
      where: { id, userId: uid },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        vertexSessionId: true,
        entries: true,
      },
    });
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      title: row.title,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      vertexSessionId: row.vertexSessionId,
      entries: parseConsultationEntries(row.entries),
    };
  });
}
