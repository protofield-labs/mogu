"use client";

import { useSyncExternalStore } from "react";

import {
  MessageScroller,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/chat";
import { AgentConsultationHistorySheet } from "@/components/search/agent-consultation-history-sheet";
import { AgentChatAutoScroll } from "@/components/search/agent-chat-auto-scroll";
import { AgentChatComposer } from "@/components/search/agent-chat-composer";
import { AgentChatHeader } from "@/components/search/agent-chat-header";
import { AgentChatTranscript } from "@/components/search/agent-chat-transcript";
import type { AgentConsultationSummary } from "@/lib/agent/browser-api";
import {
  hasSeenPersonaIntro,
  markPersonaIntroSeen,
  resetPersonaIntroSeen,
} from "@/lib/agent/persona-intro";
import { useAgentChat } from "@/lib/agent/use-agent-chat";
import { useAuth } from "@/contexts/auth-context";

const PERSONA_INTRO_CHANGE_EVENT = "mogu:persona-intro-change";

function subscribePersonaIntro(onStoreChange: () => void) {
  window.addEventListener(PERSONA_INTRO_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(PERSONA_INTRO_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function notifyPersonaIntroChange() {
  window.dispatchEvent(new Event(PERSONA_INTRO_CHANGE_EVENT));
}

export function AgentChat() {
  const { user, loading: authLoading } = useAuth();
  const chat = useAgentChat(user?.uid ?? null, authLoading);
  const showPersonaIntro = useSyncExternalStore(
    subscribePersonaIntro,
    () => !hasSeenPersonaIntro(),
    () => false,
  );

  function dismissPersonaIntro() {
    markPersonaIntroSeen();
    notifyPersonaIntroChange();
  }

  function showPersonaIntroAgain() {
    resetPersonaIntroSeen();
    notifyPersonaIntroChange();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AgentChatHeader
        sessionStatus={chat.sessionStatus}
        loadingConsultation={chat.loadingConsultation}
        sending={chat.sending}
        resettingConsultation={chat.resettingConsultation}
        onOpenHistory={() => chat.setHistoryOpen(true)}
        onNewConsultation={() => void chat.handleNewConsultation()}
        onShowPersonaIntro={showPersonaIntroAgain}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <MessageScrollerProvider>
          <MessageScroller className="min-h-0 flex-1">
            <MessageScrollerViewport className="px-mogu-screen-x py-mogu-screen-y">
              <AgentChatTranscript
                entries={chat.entries}
                thinkingMessages={chat.thinkingMessages}
                sessionStatus={chat.sessionStatus}
                consultationViewMode={chat.consultationViewMode}
                showInitialSkeleton={chat.showInitialSkeleton}
                showStructuredChips={chat.showStructuredChips}
                showPersonaIntro={showPersonaIntro}
                sending={chat.sending}
                retryingSession={chat.retryingSession}
                resettingConsultation={chat.resettingConsultation}
                initError={chat.initError}
                sendError={chat.sendError}
                inputDisabled={chat.inputDisabled}
                onChipSelect={chat.handleChipSelect}
                onSendStructured={(text, chips) => {
                  void chat.sendMessage(text, chips);
                }}
                onRetrySession={() => void chat.handleRetrySession()}
                onNewConsultation={() => void chat.handleNewConsultation()}
                onDismissPersonaIntro={dismissPersonaIntro}
              />
            </MessageScrollerViewport>
          </MessageScroller>
          <AgentChatAutoScroll
            entryCount={chat.entries.length}
            sending={chat.sending}
            sessionId={chat.sessionId}
            consultationViewMode={chat.consultationViewMode}
            preferStart={showPersonaIntro}
          />
          <AgentChatComposer
            input={chat.input}
            inputDisabled={chat.inputDisabled}
            onInputChange={chat.setInput}
            onSubmit={chat.handleSubmit}
            onSend={(text) => {
              void chat.sendMessage(text);
            }}
          />
        </MessageScrollerProvider>
      </div>

      <AgentConsultationHistorySheet
        open={chat.historyOpen}
        onClose={() => chat.setHistoryOpen(false)}
        onSelect={(consultation: AgentConsultationSummary) => {
          void chat.applyConsultationDetail(consultation.id);
        }}
      />
    </div>
  );
}
