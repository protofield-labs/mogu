"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import {
  createAgentSession,
  fetchAgentConsultation,
  syncAgentConsultationEntries,
} from "@/lib/agent/browser-api";
import {
  abortInflightAgentTurnSse,
  getInflightAgentTurn,
  sendAgentTurn,
  type SendTurnResult,
} from "@/lib/agent/send-turn";
import {
  createAgentEntry,
  createUserEntry,
  createWelcomeEntry,
  formatAgentUserError,
  isAgentSessionUnavailableError,
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
import {
  consumePendingRecommendation,
} from "@/lib/home/pending-recommendation";
import type { Recommendation } from "@/lib/agent/types";

export type SessionStatus = "loading" | "ready" | "error";
export type ConsultationViewMode = "live" | "readonly" | null;

export function useAgentChat(userId: string | null, authLoading: boolean) {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("loading");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [thinkingMessages, setThinkingMessages] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [initError, setInitError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [retryingSession, setRetryingSession] = useState(false);
  const [resettingConsultation, setResettingConsultation] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [consultationViewMode, setConsultationViewMode] =
    useState<ConsultationViewMode>(null);
  const [loadingConsultation, setLoadingConsultation] = useState(false);
  const pendingRecommendationRef = useRef<Recommendation | null | undefined>(
    undefined,
  );
  const sendingRef = useRef(false);
  const entriesRef = useRef<ChatEntry[]>([]);
  const mountInitStartedRef = useRef(false);
  const connectGenerationRef = useRef(0);
  const sessionPersistEnabledRef = useRef(true);
  const persistConsultationChainRef = useRef(Promise.resolve());

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const invalidateStoredSession = useCallback(() => {
    clearAgentChatSession();
    sessionPersistEnabledRef.current = false;
  }, []);

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

  const applyConsultationDetail = useCallback(
    async (consultationId: string) => {
      if (!userId || loadingConsultation) {
        return;
      }

      const generation = ++connectGenerationRef.current;
      setLoadingConsultation(true);
      setHistoryOpen(false);
      setSessionStatus("loading");
      setInitError(null);
      setSendError(null);
      setThinkingMessages([]);

      try {
        const detail = await fetchAgentConsultation(consultationId);
        if (generation !== connectGenerationRef.current) {
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
        if (generation !== connectGenerationRef.current) {
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
        if (generation === connectGenerationRef.current) {
          setLoadingConsultation(false);
        }
      }
    },
    [userId, loadingConsultation, invalidateStoredSession],
  );

  const applySendTurnResult = useCallback(
    (result: SendTurnResult, trimmed?: string) => {
      if (result.ok) {
        setEntries(result.entries);
        setSendError(null);
        return;
      }

      setEntries(result.entries);
      if (trimmed) {
        setInput(trimmed);
      }
      if (isAgentSessionUnavailableError(result.error)) {
        invalidateStoredSession();
        setSendError(
          "セッションの有効期限が切れました。「新しい相談」から再度お試しください。",
        );
        return;
      }
      setSendError(
        formatAgentUserError(result.error, "メッセージの送信に失敗しました"),
      );
    },
    [invalidateStoredSession],
  );

  const resumeInflightTurn = useCallback(
    async (stored: StoredAgentChatSession, generation: number) => {
      const inflight = getInflightAgentTurn(stored.userId, stored.sessionId);
      if (!inflight) {
        const pendingIndex = stored.entries.findIndex(
          (entry) => entry.id === stored.pendingUserEntryId,
        );
        const entries =
          pendingIndex === -1
            ? stored.entries
            : stored.entries.filter((_, index) => index !== pendingIndex);
        clearStalePendingAgentReply(stored.userId, stored.sessionId, entries);
        if (generation !== connectGenerationRef.current) {
          return;
        }
        setEntries(entries);
        setSendError("前回の送信を完了できませんでした。もう一度お試しください。");
        return;
      }

      sendingRef.current = true;
      setSending(true);
      setSendError(null);
      setThinkingMessages([]);

      try {
        const result = await inflight;
        if (generation !== connectGenerationRef.current) {
          return;
        }
        applySendTurnResult(result);
      } finally {
        if (generation === connectGenerationRef.current) {
          sendingRef.current = false;
          setSending(false);
          setThinkingMessages([]);
        }
      }
    },
    [applySendTurnResult],
  );

  const connectAgentChatSession = useCallback(
    async ({ isRetry = false } = {}) => {
      const generation = ++connectGenerationRef.current;

      if (isRetry) {
        setSessionStatus("loading");
        setInitError(null);
        setSendError(null);
        setConsultationViewMode(null);
      }

      if (pendingRecommendationRef.current === undefined) {
        pendingRecommendationRef.current = consumePendingRecommendation();
      }
      const pending = pendingRecommendationRef.current;

      if (pending) {
        clearAgentChatSession();
      } else if (userId) {
        const stored = loadAgentChatSession(userId);
        if (stored && generation === connectGenerationRef.current) {
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
        const id = await createAgentSession(
          pending
            ? { recommendationContext: recommendationToContext(pending) }
            : undefined,
        );
        if (generation !== connectGenerationRef.current) {
          return;
        }
        const initialEntries: ChatEntry[] = [createWelcomeEntry()];
        if (pending) {
          initialEntries.push(
            createAgentEntry({
              text: pending.assertion,
              recommendation: pending,
            }),
          );
          pendingRecommendationRef.current = null;
        }
        setSessionId(id);
        setEntries(initialEntries);
        setConsultationViewMode("live");
        sessionPersistEnabledRef.current = true;
        persistConsultationEntries(id, initialEntries);
        await persistConsultationChainRef.current;
        if (generation !== connectGenerationRef.current) {
          return;
        }
        setSessionStatus("ready");
      } catch (err) {
        if (generation !== connectGenerationRef.current) {
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
    [userId, resumeInflightTurn, persistConsultationEntries],
  );

  useEffect(() => {
    return () => {
      if (userId && sessionId && sendingRef.current) {
        abortInflightAgentTurnSse(userId, sessionId);
      }
    };
  }, [userId, sessionId]);

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
  }, [sessionStatus, sessionId, userId, entries, sending]);

  async function handleRetrySession() {
    if (retryingSession) {
      return;
    }
    setRetryingSession(true);
    try {
      await connectAgentChatSession({ isRetry: true });
    } finally {
      setRetryingSession(false);
    }
  }

  async function handleNewConsultation() {
    if (resettingConsultation || retryingSession || sending) {
      return;
    }
    setResettingConsultation(true);
    invalidateStoredSession();
    pendingRecommendationRef.current = null;
    try {
      await connectAgentChatSession({ isRetry: true });
    } finally {
      setResettingConsultation(false);
    }
  }

  const sendMessage = useCallback(
    async (text: string, chips?: string[]) => {
      if (!sessionId || !userId || sendingRef.current) {
        return;
      }
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }

      sendingRef.current = true;
      setSending(true);
      setSendError(null);
      setThinkingMessages([]);

      const entriesBefore = entriesRef.current;
      const userEntry = createUserEntry(trimmed, chips);
      if (userEntry.kind !== "user") {
        return;
      }
      setEntries([...entriesBefore, userEntry]);
      setInput("");

      try {
        const result = await sendAgentTurn({
          userId,
          sessionId,
          text: trimmed,
          chips,
          entriesBefore,
          userEntry,
          onThinking: (message) => {
            setThinkingMessages((prev) =>
              prev.includes(message) ? prev : [...prev, message],
            );
          },
        });
        applySendTurnResult(result, trimmed);
      } finally {
        sendingRef.current = false;
        setSending(false);
        setThinkingMessages([]);
      }
    },
    [sessionId, userId, applySendTurnResult],
  );

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void sendMessage(input);
  }

  function handleChipSelect(chip: string) {
    void sendMessage(chip);
  }

  const inputDisabled =
    sessionStatus !== "ready" ||
    sending ||
    retryingSession ||
    resettingConsultation ||
    loadingConsultation ||
    consultationViewMode === "readonly" ||
    !sessionId;
  const showInitialSkeleton =
    sessionStatus === "loading" &&
    entries.length === 0 &&
    !retryingSession &&
    !resettingConsultation &&
    !loadingConsultation;
  const hasUserMessages = entries.some((entry) => entry.kind === "user");
  const isWelcomeOnly =
    entries.length === 1 &&
    entries[0]?.kind === "agent" &&
    entries[0]?.id === "welcome";
  const showStructuredChips =
    sessionStatus === "ready" &&
    isWelcomeOnly &&
    !hasUserMessages &&
    !sending &&
    !resettingConsultation &&
    consultationViewMode !== "readonly";

  return {
    sessionStatus,
    sessionId,
    entries,
    thinkingMessages,
    input,
    setInput,
    initError,
    sendError,
    sending,
    retryingSession,
    resettingConsultation,
    historyOpen,
    setHistoryOpen,
    consultationViewMode,
    loadingConsultation,
    inputDisabled,
    showInitialSkeleton,
    showStructuredChips,
    handleRetrySession,
    handleNewConsultation,
    applyConsultationDetail,
    sendMessage,
    handleSubmit,
    handleChipSelect,
  };
}
