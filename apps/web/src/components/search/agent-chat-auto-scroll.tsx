"use client";

import { useEffect } from "react";

import { useMessageScroller } from "@/components/chat";
import type { ConsultationViewMode } from "@/lib/agent/use-agent-chat";

type AgentChatAutoScrollProps = {
  entryCount: number;
  sending: boolean;
  sessionId: string | null;
  consultationViewMode: ConsultationViewMode;
};

/** Scroll transcript to latest message on send / new entries (#128). */
export function AgentChatAutoScroll({
  entryCount,
  sending,
  sessionId,
  consultationViewMode,
}: AgentChatAutoScrollProps) {
  const { scrollToEnd } = useMessageScroller();

  useEffect(() => {
    scrollToEnd({ behavior: sending ? "auto" : "smooth" });
  }, [consultationViewMode, entryCount, scrollToEnd, sending, sessionId]);

  return null;
}
