"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ChatEntry } from "@/lib/agent/chat-helpers";
import { clearAgentChatSession } from "@/lib/agent/session-storage";
import { useAgentSend } from "@/lib/agent/use-agent-send";
import { useAgentSession } from "@/lib/agent/use-agent-session";
import { useConsultationHistory } from "@/lib/agent/use-consultation-history";
import { useConnectGeneration } from "@/lib/agent/use-connect-generation";
import type {
  ConsultationViewMode,
  SessionStatus,
} from "@/lib/agent/use-agent-chat-types";

export type { ConsultationViewMode, SessionStatus };

export function useAgentChat(userId: string | null, authLoading: boolean) {
  const connectGeneration = useConnectGeneration();
  const sessionPersistEnabledRef = useRef(true);
  const entriesRef = useRef<ChatEntry[]>([]);

  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("loading");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const invalidateStoredSession = useCallback(() => {
    clearAgentChatSession();
    sessionPersistEnabledRef.current = false;
  }, []);

  const send = useAgentSend({
    userId,
    sessionId,
    entriesRef,
    setEntries,
    invalidateStoredSession,
  });

  const history = useConsultationHistory({
    userId,
    connectGeneration,
    setSessionStatus,
    setSessionId,
    setEntries,
    setInitError,
    setSendError: send.setSendError,
    setThinkingMessages: send.setThinkingMessages,
    invalidateStoredSession,
    sessionPersistEnabledRef,
  });

  const session = useAgentSession({
    userId,
    authLoading,
    connectGeneration,
    sessionId,
    setSessionId,
    sessionStatus,
    setSessionStatus,
    entries,
    setEntries,
    setInitError,
    setSendError: send.setSendError,
    setConsultationViewMode: history.setConsultationViewMode,
    setThinkingMessages: send.setThinkingMessages,
    setSending: send.setSending,
    sendingRef: send.sendingRef,
    applySendTurnResult: send.applySendTurnResult,
    sessionPersistEnabledRef,
    invalidateStoredSession,
  });

  const inputDisabled =
    sessionStatus !== "ready" ||
    send.sending ||
    session.retryingSession ||
    session.resettingConsultation ||
    history.loadingConsultation ||
    history.consultationViewMode === "readonly" ||
    !sessionId;
  const showInitialSkeleton =
    sessionStatus === "loading" &&
    entries.length === 0 &&
    !session.retryingSession &&
    !session.resettingConsultation &&
    !history.loadingConsultation;
  const hasUserMessages = entries.some((entry) => entry.kind === "user");
  const isWelcomeOnly =
    entries.length === 1 &&
    entries[0]?.kind === "agent" &&
    entries[0]?.id === "welcome";
  const showStructuredChips =
    sessionStatus === "ready" &&
    isWelcomeOnly &&
    !hasUserMessages &&
    !send.sending &&
    !session.resettingConsultation &&
    history.consultationViewMode !== "readonly";

  return {
    sessionStatus,
    sessionId,
    entries,
    thinkingMessages: send.thinkingMessages,
    input: send.input,
    setInput: send.setInput,
    initError,
    sendError: send.sendError,
    sending: send.sending,
    retryingSession: session.retryingSession,
    resettingConsultation: session.resettingConsultation,
    historyOpen: history.historyOpen,
    setHistoryOpen: history.setHistoryOpen,
    consultationViewMode: history.consultationViewMode,
    loadingConsultation: history.loadingConsultation,
    inputDisabled,
    showInitialSkeleton,
    showStructuredChips,
    handleRetrySession: session.handleRetrySession,
    handleNewConsultation: session.handleNewConsultation,
    applyConsultationDetail: history.applyConsultationDetail,
    sendMessage: send.sendMessage,
    handleSubmit: send.handleSubmit,
    handleChipSelect: send.handleChipSelect,
  };
}
