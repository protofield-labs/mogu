"use client";

import { useCallback, useState, type Dispatch, type SetStateAction } from "react";

import { fetchAgentConsultation } from "@/lib/agent/browser-api";
import {
  createWelcomeEntry,
  formatAgentUserError,
  type ChatEntry,
} from "@/lib/agent/chat-helpers";
import {
  saveAgentChatSession,
} from "@/lib/agent/session-storage";
import type { ConnectGeneration } from "@/lib/agent/use-connect-generation";
import type { ConsultationViewMode } from "@/lib/agent/use-agent-chat-types";

type UseConsultationHistoryOptions = {
  userId: string | null;
  connectGeneration: ConnectGeneration;
  setSessionStatus: Dispatch<SetStateAction<"loading" | "ready" | "error">>;
  setSessionId: Dispatch<SetStateAction<string | null>>;
  setEntries: Dispatch<SetStateAction<ChatEntry[]>>;
  setInitError: Dispatch<SetStateAction<string | null>>;
  setSendError: Dispatch<SetStateAction<string | null>>;
  setThinkingMessages: Dispatch<SetStateAction<string[]>>;
  invalidateStoredSession: () => void;
  sessionPersistEnabledRef: React.RefObject<boolean>;
};

export function useConsultationHistory(options: UseConsultationHistoryOptions) {
  const {
    userId,
    connectGeneration,
    setSessionStatus,
    setSessionId,
    setEntries,
    setInitError,
    setSendError,
    setThinkingMessages,
    invalidateStoredSession,
    sessionPersistEnabledRef,
  } = options;

  const { bumpGeneration, isStale, isCurrent } = connectGeneration;
  const [historyOpen, setHistoryOpen] = useState(false);
  const [consultationViewMode, setConsultationViewMode] =
    useState<ConsultationViewMode>(null);
  const [loadingConsultation, setLoadingConsultation] = useState(false);

  const applyConsultationDetail = useCallback(
    async (consultationId: string) => {
      if (!userId || loadingConsultation) {
        return;
      }

      const generation = bumpGeneration();
      setLoadingConsultation(true);
      setHistoryOpen(false);
      setSessionStatus("loading");
      setInitError(null);
      setSendError(null);
      setThinkingMessages([]);

      try {
        const detail = await fetchAgentConsultation(consultationId);
        if (isStale(generation)) {
          return;
        }

        const nextEntries =
          detail.entries.length > 0 ? detail.entries : [createWelcomeEntry()];

        if (detail.resumable) {
          setConsultationViewMode("live");
          setSessionId(detail.vertexSessionId);
          setEntries(nextEntries);
          sessionPersistEnabledRef.current = true;
          saveAgentChatSession(userId, detail.vertexSessionId, nextEntries);
        } else {
          invalidateStoredSession();
          setConsultationViewMode("readonly");
          setSessionId(null);
          setEntries(nextEntries);
        }

        setSessionStatus("ready");
      } catch (err) {
        if (isStale(generation)) {
          return;
        }
        setConsultationViewMode(null);
        setSessionId(null);
        setEntries([createWelcomeEntry()]);
        setInitError(
          formatAgentUserError(err, "相談履歴を開けませんでした"),
        );
        setSessionStatus("error");
      } finally {
        if (isCurrent(generation)) {
          setLoadingConsultation(false);
        }
      }
    },
    [
      bumpGeneration,
      invalidateStoredSession,
      isCurrent,
      isStale,
      loadingConsultation,
      sessionPersistEnabledRef,
      setEntries,
      setInitError,
      setSendError,
      setSessionId,
      setSessionStatus,
      setThinkingMessages,
      userId,
    ],
  );

  return {
    historyOpen,
    setHistoryOpen,
    consultationViewMode,
    setConsultationViewMode,
    loadingConsultation,
    applyConsultationDetail,
  };
}
