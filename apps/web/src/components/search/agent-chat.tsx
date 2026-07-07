"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircleIcon, MessageSquarePlusIcon, SparklesIcon } from "lucide-react";

import { MoguBrandIcon } from "@/components/brand/mogu-brand-icon";
import { MoguWordmark } from "@/components/brand/mogu-wordmark";

import {
  Bubble,
  BubbleContent,
  BubbleGroup,
  Marker,
  MarkerContent,
  MarkerIcon,
  Message,
  MessageAvatar,
  MessageContent,
  MessageGroup,
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/chat";
import { Button } from "@/components/ui/button";
import { createAgentSession } from "@/lib/agent/browser-api";
import {
  abortInflightAgentTurnSse,
  getInflightAgentTurn,
  sendAgentTurn,
  type SendTurnResult,
} from "@/lib/agent/send-turn";
import {
  AGENT_FOOTER_CAPTION,
  createAgentEntry,
  createUserEntry,
  createWelcomeEntry,
  formatAgentUserError,
  formatUserBubbleText,
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
import {
  consumePendingRecommendation,
} from "@/lib/home/pending-recommendation";
import type { Recommendation } from "@/lib/agent/types";
import { AgentChatSkeleton } from "@/components/loading/skeletons";
import { AgentStructuredChips } from "@/components/search/agent-structured-chips";
import { RecommendationCard } from "@/components/search/recommendation-card";
import { useAuth } from "@/contexts/auth-context";

type SessionStatus = "loading" | "ready" | "error";

function AgentAvatar() {
  return (
    <MessageAvatar className="size-8 bg-mogu-surface-elevated text-foreground">
      <MoguBrandIcon className="size-4" />
    </MessageAvatar>
  );
}

function TypingIndicator() {
  return (
    <Message align="start">
      <AgentAvatar />
      <MessageContent>
        <BubbleGroup>
          <Bubble variant="outline" align="start">
            <BubbleContent aria-live="polite" aria-label="考え中">
              <span className="flex items-center gap-1 py-1">
                <span className="size-2 rounded-full bg-muted-foreground/60 motion-safe:animate-bounce [animation-delay:-0.3s]" />
                <span className="size-2 rounded-full bg-muted-foreground/60 motion-safe:animate-bounce [animation-delay:-0.15s]" />
                <span className="size-2 rounded-full bg-muted-foreground/60 motion-safe:animate-bounce" />
              </span>
            </BubbleContent>
          </Bubble>
        </BubbleGroup>
      </MessageContent>
    </Message>
  );
}

function UserBubble({ entry }: { entry: Extract<ChatEntry, { kind: "user" }> }) {
  return (
    <Message align="end">
      <MessageContent>
        <BubbleGroup>
          <Bubble variant="muted" align="end">
            <BubbleContent>{formatUserBubbleText(entry)}</BubbleContent>
          </Bubble>
        </BubbleGroup>
      </MessageContent>
    </Message>
  );
}

function AgentBubble({
  entry,
  onChipSelect,
  disabled,
}: {
  entry: Extract<ChatEntry, { kind: "agent" }>;
  onChipSelect: (chip: string) => void;
  disabled: boolean;
}) {
  return (
    <Message align="start">
      <AgentAvatar />
      <MessageContent>
        <BubbleGroup>
          <Bubble variant="outline" align="start">
            <BubbleContent>
              <p className="whitespace-pre-wrap">{entry.text}</p>
              {entry.quickReplies?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {entry.quickReplies.map((chip) => (
                    <Button
                      key={chip}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={disabled}
                      onClick={() => onChipSelect(chip)}
                    >
                      {chip}
                    </Button>
                  ))}
                </div>
              ) : null}
            </BubbleContent>
          </Bubble>
        </BubbleGroup>
        {entry.recommendation ? (
          <RecommendationCard recommendation={entry.recommendation} />
        ) : null}
      </MessageContent>
    </Message>
  );
}

export function AgentChat() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.uid ?? null;
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
  const pendingRecommendationRef = useRef<Recommendation | null | undefined>(
    undefined,
  );
  const sendingRef = useRef(false);
  const entriesRef = useRef<ChatEntry[]>([]);
  const mountInitStartedRef = useRef(false);
  const connectGenerationRef = useRef(0);
  const sessionPersistEnabledRef = useRef(true);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const invalidateStoredSession = useCallback(() => {
    clearAgentChatSession();
    sessionPersistEnabledRef.current = false;
  }, []);

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
      }

      if (pendingRecommendationRef.current === undefined) {
        pendingRecommendationRef.current = consumePendingRecommendation();
      }
      const pending = pendingRecommendationRef.current;

      if (!pending && userId) {
        const stored = loadAgentChatSession(userId);
        if (stored && generation === connectGenerationRef.current) {
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
        const id = await createAgentSession();
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
        setSessionStatus("ready");
        sessionPersistEnabledRef.current = true;
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
    [userId, resumeInflightTurn],
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

  function handleSubmit(event: React.FormEvent) {
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
    !sessionId;
  const showInitialSkeleton =
    sessionStatus === "loading" &&
    entries.length === 0 &&
    !retryingSession &&
    !resettingConsultation;
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
    !resettingConsultation;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-mogu-screen-x py-3">
        <div className="flex items-center gap-2">
          <MoguBrandIcon className="size-5" />
          <MoguWordmark as="h1" />
        </div>
        {sessionStatus === "ready" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={resettingConsultation || sending}
            onClick={() => void handleNewConsultation()}
            className="text-muted-foreground"
          >
            {resettingConsultation ? (
              <>
                <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
                開始中…
              </>
            ) : (
              <>
                <MessageSquarePlusIcon className="size-4" aria-hidden />
                新しい相談
              </>
            )}
          </Button>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <MessageScrollerProvider>
          <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport className="px-mogu-screen-x py-mogu-screen-y">
            <MessageScrollerContent>
              {showInitialSkeleton ? (
                <MessageScrollerItem>
                  <AgentChatSkeleton />
                </MessageScrollerItem>
              ) : null}

              {entries.map((entry) => (
                <MessageScrollerItem key={entry.id} scrollAnchor>
                  <MessageGroup>
                    {entry.kind === "user" ? (
                      <UserBubble entry={entry} />
                    ) : (
                      <>
                        <AgentBubble
                          entry={entry}
                          onChipSelect={handleChipSelect}
                          disabled={inputDisabled}
                        />
                        {entry.id === "welcome" && showStructuredChips ? (
                          <Message align="start">
                            <AgentAvatar />
                            <MessageContent>
                              <AgentStructuredChips
                                disabled={inputDisabled}
                                onSend={(text, chips) => {
                                  void sendMessage(text, chips);
                                }}
                              />
                            </MessageContent>
                          </Message>
                        ) : null}
                      </>
                    )}
                  </MessageGroup>
                </MessageScrollerItem>
              ))}

              {thinkingMessages.length > 0 ? (
                <MessageScrollerItem scrollAnchor>
                  <MessageGroup>
                    {thinkingMessages.map((message) => (
                      <Marker key={message} variant="separator">
                        <MarkerIcon>
                          <LoaderCircleIcon className="size-4 animate-spin" />
                        </MarkerIcon>
                        <MarkerContent>{message}</MarkerContent>
                      </Marker>
                    ))}
                  </MessageGroup>
                </MessageScrollerItem>
              ) : null}

              {sending ? (
                <MessageScrollerItem
                  scrollAnchor={thinkingMessages.length === 0}
                >
                  <MessageGroup>
                    <TypingIndicator />
                  </MessageGroup>
                </MessageScrollerItem>
              ) : null}

              {sessionStatus === "error" && initError ? (
                <MessageScrollerItem>
                  <div
                    className="flex flex-col gap-3 rounded-2xl border border-border bg-mogu-surface-elevated px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    role="alert"
                  >
                    <p className="text-sm text-destructive">{initError}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={retryingSession}
                      onClick={() => void handleRetrySession()}
                      className="shrink-0"
                    >
                      {retryingSession ? (
                        <>
                          <LoaderCircleIcon
                            className="size-4 animate-spin"
                            aria-hidden
                          />
                          接続中…
                        </>
                      ) : (
                        "再接続"
                      )}
                    </Button>
                  </div>
                </MessageScrollerItem>
              ) : null}

              {sendError ? (
                <MessageScrollerItem>
                  <p className="text-sm text-destructive" role="alert">
                    {sendError}
                  </p>
                </MessageScrollerItem>
              ) : null}
            </MessageScrollerContent>
          </MessageScrollerViewport>
        </MessageScroller>
        </MessageScrollerProvider>
      </div>

      <footer className="shrink-0 border-t border-border px-mogu-screen-x pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <label className="sr-only" htmlFor="agent-message-input">
            メッセージ
          </label>
          <textarea
            id="agent-message-input"
            rows={1}
            value={input}
            disabled={inputDisabled}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendMessage(input);
              }
            }}
            placeholder="メッセージを入力..."
            className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-border bg-mogu-surface-elevated px-4 py-2.5 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          />
          <Button
            type="submit"
            size="icon"
            className="size-10 shrink-0 rounded-full"
            disabled={inputDisabled || !input.trim()}
            aria-label="送信"
          >
            <SparklesIcon className="size-4" />
          </Button>
        </form>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {AGENT_FOOTER_CAPTION}
        </p>
      </footer>
    </div>
  );
}
