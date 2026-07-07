"use client";

import { LoaderCircleIcon } from "lucide-react";

import {
  Marker,
  MarkerContent,
  MarkerIcon,
  Message,
  MessageContent,
  MessageGroup,
  MessageScrollerContent,
  MessageScrollerItem,
} from "@/components/chat";
import { AgentChatSkeleton } from "@/components/loading/skeletons";
import {
  AgentAvatar,
  AgentBubble,
  TypingIndicator,
  UserBubble,
} from "@/components/search/agent-chat-bubbles";
import { AgentStructuredChips } from "@/components/search/agent-structured-chips";
import { Button } from "@/components/ui/button";
import type { ChatEntry } from "@/lib/agent/chat-helpers";
import type {
  ConsultationViewMode,
  SessionStatus,
} from "@/lib/agent/use-agent-chat";

type AgentChatTranscriptProps = {
  entries: ChatEntry[];
  thinkingMessages: string[];
  sessionStatus: SessionStatus;
  consultationViewMode: ConsultationViewMode;
  showInitialSkeleton: boolean;
  showStructuredChips: boolean;
  sending: boolean;
  retryingSession: boolean;
  resettingConsultation: boolean;
  initError: string | null;
  sendError: string | null;
  inputDisabled: boolean;
  onChipSelect: (chip: string) => void;
  onSendStructured: (text: string, chips?: string[]) => void;
  onRetrySession: () => void;
  onNewConsultation: () => void;
};

export function AgentChatTranscript({
  entries,
  thinkingMessages,
  sessionStatus,
  consultationViewMode,
  showInitialSkeleton,
  showStructuredChips,
  sending,
  retryingSession,
  resettingConsultation,
  initError,
  sendError,
  inputDisabled,
  onChipSelect,
  onSendStructured,
  onRetrySession,
  onNewConsultation,
}: AgentChatTranscriptProps) {
  return (
    <MessageScrollerContent>
      {showInitialSkeleton ? (
        <MessageScrollerItem>
          <AgentChatSkeleton />
        </MessageScrollerItem>
      ) : null}

      {consultationViewMode === "readonly" ? (
        <MessageScrollerItem>
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-mogu-surface-elevated px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              この相談は再開できません。内容は閲覧のみです。
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={resettingConsultation}
              onClick={onNewConsultation}
              className="shrink-0"
            >
              新しい相談
            </Button>
          </div>
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
                  onChipSelect={onChipSelect}
                  disabled={inputDisabled}
                />
                {entry.id === "welcome" && showStructuredChips ? (
                  <Message align="start">
                    <AgentAvatar />
                    <MessageContent>
                      <AgentStructuredChips
                        disabled={inputDisabled}
                        onSend={onSendStructured}
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
        <MessageScrollerItem scrollAnchor={thinkingMessages.length === 0}>
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
              onClick={onRetrySession}
              className="shrink-0"
            >
              {retryingSession ? (
                <>
                  <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
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
  );
}
