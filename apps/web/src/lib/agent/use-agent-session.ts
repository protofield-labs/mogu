"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import {
  createAgentSession,
  syncAgentConsultationEntries,
} from "@/lib/agent/browser-api";
import {
  abortInflightAgentTurnSse,
  getInflightAgentTurn,
} from "@/lib/agent/send-turn";
import {
  createAgentEntry,
  createWelcomeEntry,
  formatAgentUserError,
  type ChatEntry,
} from "@/lib/agent/chat-helpers";
import {
  clearAgentChatSession,
  clearStalePendingAgentReply,
  isAgentReplyPending,
  loadAgentChatSession,
  saveAgentChatSession,
  type StoredAgentChatSession,
} from "@/lib/agent/session-storage";
import { recommendationToContext } from "@/lib/agent/recommendation-context-message";
import { collectionConsultDisplayMessage } from "@/lib/agent/collection-context-message";
import {
  clearPendingRecommendation,
  commitPendingRecommendation,
  resolvePendingRecommendation,
} from "@/lib/home/pending-recommendation";
import {
  clearPendingCollectionConsult,
  commitPendingCollectionConsult,
  resolvePendingCollectionConsult,
} from "@/lib/mypage/pending-collection-consult";
import type { CreateAgentSessionRequest } from "@/lib/agent/types";
import type { ConnectGeneration } from "@/lib/agent/use-connect-generation";
import type { ConsultationViewMode, SessionStatus } from "@/lib/agent/use-agent-chat-types";
import type { SendTurnResult } from "@/lib/agent/send-turn";

type UseAgentSessionOptions = {
  userId: string | null;
  authLoading: boolean;
  connectGeneration: ConnectGeneration;
  sessionId: string | null;
  setSessionId: Dispatch<SetStateAction<string | null>>;
  sessionStatus: SessionStatus;
  setSessionStatus: Dispatch<SetStateAction<SessionStatus>>;
  entries: ChatEntry[];
  setEntries: Dispatch<SetStateAction<ChatEntry[]>>;
  setInitError: Dispatch<SetStateAction<string | null>>;
  setSendError: Dispatch<SetStateAction<string | null>>;
  setConsultationViewMode: Dispatch<SetStateAction<ConsultationViewMode>>;
  setThinkingMessages: Dispatch<SetStateAction<string[]>>;
  setSending: Dispatch<SetStateAction<boolean>>;
  sendingRef: React.RefObject<boolean>;
  applySendTurnResult: (result: SendTurnResult, trimmed?: string) => void;
  sessionPersistEnabledRef: React.RefObject<boolean>;
  invalidateStoredSession: () => void;
};

export function useAgentSession(options: UseAgentSessionOptions) {
  const {
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
    setSendError,
    setConsultationViewMode,
    setThinkingMessages,
    setSending,
    sendingRef,
    applySendTurnResult,
    sessionPersistEnabledRef,
    invalidateStoredSession,
  } = options;

  const { bumpGeneration, isStale, isCurrent } = connectGeneration;
  const entriesRef = useRef<ChatEntry[]>([]);
  const mountInitStartedRef = useRef(false);
  const persistConsultationChainRef = useRef(Promise.resolve());
  const [retryingSession, setRetryingSession] = useState(false);
  const [resettingConsultation, setResettingConsultation] = useState(false);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const persistConsultationEntries = useCallback(
    (vertexSessionId: string, nextEntries: ChatEntry[]) => {
      if (!userId) {
        return;
      }
      persistConsultationChainRef.current = persistConsultationChainRef.current
        .then(async () => {
          await syncAgentConsultationEntries(vertexSessionId, nextEntries);
        })
        .catch(() => {
          // Best-effort; live chat should continue even if history sync fails.
        });
    },
    [userId],
  );

  const resumeInflightTurn = useCallback(
    async (stored: StoredAgentChatSession, generation: number) => {
      const inflight = getInflightAgentTurn(stored.userId, stored.sessionId);
      if (!inflight) {
        const pendingIndex = stored.entries.findIndex(
          (entry) => entry.id === stored.pendingUserEntryId,
        );
        const nextEntries =
          pendingIndex === -1
            ? stored.entries
            : stored.entries.filter((_, index) => index !== pendingIndex);
        clearStalePendingAgentReply(stored.userId, stored.sessionId, nextEntries);
        if (isStale(generation)) {
          return;
        }
        setEntries(nextEntries);
        setSendError("前回の送信を完了できませんでした。もう一度お試しください。");
        return;
      }

      sendingRef.current = true;
      setSending(true);
      setSendError(null);
      setThinkingMessages([]);

      try {
        const result = await inflight;
        if (isStale(generation)) {
          return;
        }
        applySendTurnResult(result);
      } finally {
        if (isCurrent(generation)) {
          sendingRef.current = false;
          setSending(false);
          setThinkingMessages([]);
        }
      }
    },
    [
      applySendTurnResult,
      isCurrent,
      isStale,
      sendingRef,
      setEntries,
      setSendError,
      setSending,
      setThinkingMessages,
    ],
  );

  const connectAgentChatSession = useCallback(
    async ({ isRetry = false } = {}) => {
      const generation = bumpGeneration();

      if (isRetry) {
        setSessionStatus("loading");
        setInitError(null);
        setSendError(null);
        setConsultationViewMode(null);
      }

      const pendingRecommendation = resolvePendingRecommendation();
      const pendingCollection = resolvePendingCollectionConsult();
      const pendingHandoff = pendingRecommendation ?? pendingCollection;

      if (pendingHandoff) {
        clearAgentChatSession();
      } else if (userId) {
        const stored = loadAgentChatSession(userId);
        if (stored && isCurrent(generation)) {
          setConsultationViewMode("live");
          setSessionId(stored.sessionId);
          setEntries(stored.entries);
          setSessionStatus("ready");
          sessionPersistEnabledRef.current = true;
          if (isAgentReplyPending(stored)) {
            void resumeInflightTurn(stored, generation);
          }
          return;
        }
      }

      try {
        const sessionOptions: CreateAgentSessionRequest | undefined =
          pendingRecommendation
            ? { recommendationContext: recommendationToContext(pendingRecommendation) }
            : pendingCollection
              ? { collectionContext: pendingCollection }
              : undefined;
        const id = await createAgentSession(sessionOptions);
        if (isStale(generation)) {
          return;
        }
        const initialEntries: ChatEntry[] =
          pendingHandoff ? [] : [createWelcomeEntry()];
        if (pendingRecommendation) {
          initialEntries.push(
            createAgentEntry({
              text: pendingRecommendation.assertion,
              recommendation: pendingRecommendation,
            }),
          );
          commitPendingRecommendation();
        } else if (pendingCollection) {
          initialEntries.push(
            createAgentEntry({
              text: collectionConsultDisplayMessage(pendingCollection),
            }),
          );
          commitPendingCollectionConsult();
        }
        setSessionId(id);
        setEntries(initialEntries);
        setConsultationViewMode("live");
        sessionPersistEnabledRef.current = true;
        persistConsultationEntries(id, initialEntries);
        await persistConsultationChainRef.current;
        if (isStale(generation)) {
          return;
        }
        setSessionStatus("ready");
      } catch (err) {
        if (isStale(generation)) {
          return;
        }
        setSessionId(null);
        setInitError(
          formatAgentUserError(err, "セッションの開始に失敗しました"),
        );
        setEntries([createWelcomeEntry()]);
        setSessionStatus("error");
      }
    },
    [
      bumpGeneration,
      isCurrent,
      isStale,
      persistConsultationEntries,
      resumeInflightTurn,
      sessionPersistEnabledRef,
      setConsultationViewMode,
      setEntries,
      setInitError,
      setSendError,
      setSessionId,
      setSessionStatus,
      userId,
    ],
  );

  useEffect(() => {
    return () => {
      if (userId && sessionId && sendingRef.current) {
        abortInflightAgentTurnSse(userId, sessionId);
      }
    };
  }, [userId, sessionId, sendingRef]);

  useEffect(() => {
    if (authLoading || mountInitStartedRef.current) {
      return;
    }
    mountInitStartedRef.current = true;
    queueMicrotask(() => {
      void connectAgentChatSession();
    });
  }, [authLoading, connectAgentChatSession]);

  useEffect(() => {
    if (
      !sessionPersistEnabledRef.current ||
      sessionStatus !== "ready" ||
      !sessionId ||
      !userId ||
      entries.length === 0 ||
      sendingRef.current
    ) {
      return;
    }
    saveAgentChatSession(userId, sessionId, entries);
  }, [sessionStatus, sessionId, userId, entries, sendingRef, sessionPersistEnabledRef]);

  const handleRetrySession = useCallback(async () => {
    if (retryingSession) {
      return;
    }
    setRetryingSession(true);
    try {
      await connectAgentChatSession({ isRetry: true });
    } finally {
      setRetryingSession(false);
    }
  }, [connectAgentChatSession, retryingSession]);

  const handleNewConsultation = useCallback(async () => {
    if (resettingConsultation || retryingSession || sendingRef.current) {
      return;
    }
    setResettingConsultation(true);
    invalidateStoredSession();
    clearPendingRecommendation();
    clearPendingCollectionConsult();
    try {
      await connectAgentChatSession({ isRetry: true });
    } finally {
      setResettingConsultation(false);
    }
  }, [
    connectAgentChatSession,
    invalidateStoredSession,
    resettingConsultation,
    retryingSession,
    sendingRef,
  ]);

  return {
    retryingSession,
    resettingConsultation,
    handleRetrySession,
    handleNewConsultation,
    entriesRef,
  };
}
