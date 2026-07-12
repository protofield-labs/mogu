"use client";

import { useEffect } from "react";

import { useMessageScroller } from "@/components/chat";
import { useAgentChatContext } from "@/components/search/agent-chat-context";

/** Scroll transcript to latest message on send / new entries (#128). */
export function AgentChatAutoScroll() {
  const { state, meta } = useAgentChatContext();
  const { sending, consultationViewMode } = state;
  const entryCount = state.entries.length;
  const sessionId = meta.sessionId;
  const { scrollToEnd } = useMessageScroller();

  useEffect(() => {
    scrollToEnd({ behavior: sending ? "auto" : "smooth" });
  }, [
    consultationViewMode,
    entryCount,
    scrollToEnd,
    sending,
    sessionId,
  ]);

  return null;
}
