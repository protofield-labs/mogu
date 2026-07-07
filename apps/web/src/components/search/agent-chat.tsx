"use client";

import {
  MessageScroller,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/chat";
import { AgentConsultationHistorySheet } from "@/components/search/agent-consultation-history-sheet";
import { AgentChatComposer } from "@/components/search/agent-chat-composer";
import { AgentChatHeader } from "@/components/search/agent-chat-header";
import { AgentChatTranscript } from "@/components/search/agent-chat-transcript";
import type { AgentConsultationSummary } from "@/lib/agent/browser-api";
import { useAgentChat } from "@/lib/agent/use-agent-chat";
import { useAuth } from "@/contexts/auth-context";

export function AgentChat() {
  const { user, loading: authLoading } = useAuth();
  const chat = useAgentChat(user?.uid ?? null, authLoading);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AgentChatHeader
        sessionStatus={chat.sessionStatus}
        loadingConsultation={chat.loadingConsultation}
        sending={chat.sending}
        resettingConsultation={chat.resettingConsultation}
        onOpenHistory={() => chat.setHistoryOpen(true)}
        onNewConsultation={() => void chat.handleNewConsultation()}
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
              />
            </MessageScrollerViewport>
          </MessageScroller>
        </MessageScrollerProvider>
      </div>

      <AgentChatComposer
        input={chat.input}
        inputDisabled={chat.inputDisabled}
        onInputChange={chat.setInput}
        onSubmit={chat.handleSubmit}
        onSend={(text) => {
          void chat.sendMessage(text);
        }}
      />

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
