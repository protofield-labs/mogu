"use client";

import { useEffect } from "react";

import { useMessageScroller } from "@/components/chat";
import type { ConsultationViewMode } from "@/lib/agent/use-agent-chat";

type AgentChatAutoScrollProps = {
  entryCount: number;
  sending: boolean;
  sessionId: string | null;
  consultationViewMode: ConsultationViewMode;
  /** Keep persona intro (#291) in view until the user starts chatting. */
  preferStart?: boolean;
};

/** Scroll transcript to latest message on send / new entries (#128). */
export function AgentChatAutoScroll({
  entryCount,
  sending,
  sessionId,
  consultationViewMode,
  preferStart = false,
}: AgentChatAutoScrollProps) {
  const { scrollToEnd, scrollToStart } = useMessageScroller();

  useEffect(() => {
    // Intro only: stay at top. Once the user sends (or history loads more
    // than the welcome bubble), follow the conversation to the end (#291).
    if (preferStart && !sending && entryCount <= 1) {
      scrollToStart({ behavior: "auto" });
      return;
    }
    scrollToEnd({ behavior: sending ? "auto" : "smooth" });
  }, [
    consultationViewMode,
    entryCount,
    preferStart,
    scrollToEnd,
    scrollToStart,
    sending,
    sessionId,
  ]);

  return null;
}
