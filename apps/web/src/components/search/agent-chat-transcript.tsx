"use client";

import { LoaderCircleIcon } from "lucide-react";

import { MoguBrandIcon } from "@/components/brand/mogu-brand-icon";
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
import { useAgentChatContext } from "@/components/search/agent-chat-context";
import { AgentStructuredChips } from "@/components/search/agent-structured-chips";
import { Button } from "@/components/ui/button";

export function AgentChatTranscript() {
  const { state, actions } = useAgentChatContext();
  const {
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
  } = state;
  return (
    <MessageScrollerContent>
      {showInitialSkeleton ? (
        <MessageScrollerItem>
          <AgentChatSkeleton />
        </MessageScrollerItem>
      ) : null}

      {consultationViewMode === "readonly" ? (
        <MessageScrollerItem>
          <div className="flex flex-col gap-3 rounded-2xl bg-mogu-surface-elevated px-4 py-3 shadow-mogu-card sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              この相談は再開できません。内容は閲覧のみです。
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={resettingConsultation}
              onClick={actions.newConsultation}
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
                  onChipSelect={actions.handleChipSelect}
                  disabled={inputDisabled}
                />
                {entry.id === "welcome" && showStructuredChips ? (
                  <Message align="start">
                    <AgentAvatar />
                    <MessageContent>
                      <AgentStructuredChips
                        disabled={inputDisabled}
                        onSend={actions.sendMessage}
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
            <Marker variant="separator">
              <MarkerIcon>
                <MoguBrandIcon className="size-4" />
              </MarkerIcon>
              <MarkerContent>moguがお店を探しています…</MarkerContent>
            </Marker>
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
            className="flex flex-col gap-3 rounded-2xl bg-mogu-surface-elevated px-4 py-3 shadow-mogu-card sm:flex-row sm:items-center sm:justify-between"
            role="alert"
          >
            <p className="text-sm text-destructive">{initError}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={retryingSession}
              onClick={actions.retrySession}
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
