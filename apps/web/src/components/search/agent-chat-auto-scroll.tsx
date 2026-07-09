"use client";

import { useEffect } from "react";

import { useMessageScroller } from "@/components/chat";
import { useAgentChatContext } from "@/components/search/agent-chat-context";

/** Scroll transcript to latest message on send / new entries (#128). */
export function AgentChatAutoScroll() {
  const { state, meta } = useAgentChatContext();
  const { sending, consultationViewMode } = state;
  const entryCount = state.entries.length;
  // Keep persona intro (#291) in view until the user starts chatting.
  const preferStart = state.showPersonaIntro;
  const sessionId = meta.sessionId;
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
