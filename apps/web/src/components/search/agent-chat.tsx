"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircleIcon, SparklesIcon } from "lucide-react";

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
import {
  createAgentSession,
  connectAgentEvents,
  sendAgentMessage,
} from "@/lib/agent/browser-api";
import {
  AGENT_FOOTER_CAPTION,
  createAgentEntry,
  createUserEntry,
  createWelcomeEntry,
  formatUserBubbleText,
  type ChatEntry,
} from "@/lib/agent/chat-helpers";
import { consumePendingRecommendation } from "@/lib/home/pending-recommendation";
import { RecommendationCard } from "@/components/search/recommendation-card";

function AgentAvatar() {
  return (
    <MessageAvatar className="size-8 bg-mogu-surface-elevated text-foreground">
      <SparklesIcon className="size-4" aria-hidden />
    </MessageAvatar>
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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [thinkingMessages, setThinkingMessages] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initRef = useRef(false);
  const sendingRef = useRef(false);

  useEffect(() => {
    if (initRef.current) {
      return;
    }
    initRef.current = true;

    void (async () => {
      try {
        const id = await createAgentSession();
        const pending = consumePendingRecommendation();
        const initialEntries: ChatEntry[] = [createWelcomeEntry()];
        if (pending) {
          initialEntries.push(
            createAgentEntry({
              text: pending.assertion,
              recommendation: pending,
            }),
          );
        }
        setSessionId(id);
        setEntries(initialEntries);
      } catch (err) {
        setError(err instanceof Error ? err.message : "セッションの開始に失敗しました");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sendMessage = useCallback(
    async (text: string, chips?: string[]) => {
      if (!sessionId || sendingRef.current) {
        return;
      }
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }

      sendingRef.current = true;
      setSending(true);
      setError(null);
      setThinkingMessages([]);
      const userEntry = createUserEntry(trimmed, chips);
      setEntries((prev) => [...prev, userEntry]);
      setInput("");

      const abort = new AbortController();
      const seenThinking = new Set<string>();

      try {
        await connectAgentEvents(
          sessionId,
          (event) => {
            if (event.type !== "thinking") {
              return;
            }
            if (seenThinking.has(event.message)) {
              return;
            }
            seenThinking.add(event.message);
            setThinkingMessages((prev) => [...prev, event.message]);
          },
          abort.signal,
        );

        const agentMessage = await sendAgentMessage(sessionId, {
          text: trimmed,
          chips,
        });

        setEntries((prev) => [
          ...prev,
          createAgentEntry({
            text: agentMessage.text,
            recommendation: agentMessage.recommendation,
            quickReplies: agentMessage.quickReplies,
          }),
        ]);
      } catch (err) {
        // Roll back the optimistic user bubble and restore the draft for retry.
        setEntries((prev) => prev.filter((entry) => entry.id !== userEntry.id));
        setInput(trimmed);
        setError(err instanceof Error ? err.message : "メッセージの送信に失敗しました");
      } finally {
        abort.abort();
        setThinkingMessages([]);
        sendingRef.current = false;
        setSending(false);
      }
    },
    [sessionId],
  );

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    void sendMessage(input);
  }

  function handleChipSelect(chip: string) {
    void sendMessage(chip);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-mogu-screen-x py-3">
        <div className="flex items-center gap-2 text-base font-semibold text-foreground">
          <SparklesIcon className="size-4" aria-hidden />
          mogu
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <MessageScrollerProvider>
          <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport className="px-mogu-screen-x py-mogu-screen-y">
            <MessageScrollerContent>
              {loading ? (
                <MessageScrollerItem>
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <LoaderCircleIcon className="size-4 animate-spin" />
                    セッションを準備中…
                  </div>
                </MessageScrollerItem>
              ) : null}

              {entries.map((entry) => (
                <MessageScrollerItem key={entry.id} scrollAnchor>
                  <MessageGroup>
                    {entry.kind === "user" ? (
                      <UserBubble entry={entry} />
                    ) : (
                      <AgentBubble
                        entry={entry}
                        onChipSelect={handleChipSelect}
                        disabled={sending}
                      />
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

              {error ? (
                <MessageScrollerItem>
                  <p className="text-sm text-destructive" role="alert">
                    {error}
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
            disabled={loading || sending || !sessionId}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendMessage(input);
              }
            }}
            placeholder="メッセージを入力..."
            className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          />
          <Button
            type="submit"
            size="icon"
            className="size-10 shrink-0 rounded-full"
            disabled={loading || sending || !sessionId || !input.trim()}
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
