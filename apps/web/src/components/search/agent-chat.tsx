"use client";

import {
  MessageScroller,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/chat";
import { AgentConsultationHistorySheet } from "@/components/search/agent-consultation-history-sheet";
import { AgentChatAutoScroll } from "@/components/search/agent-chat-auto-scroll";
import { AgentChatComposer } from "@/components/search/agent-chat-composer";
import {
  AgentChatProvider,
  useAgentChatContext,
} from "@/components/search/agent-chat-context";
import { AgentChatHeader } from "@/components/search/agent-chat-header";
import { AgentChatTranscript } from "@/components/search/agent-chat-transcript";

export function AgentChat() {
  return (
    <AgentChatProvider>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <AgentChatHeader />

        <div className="flex min-h-0 flex-1 flex-col">
          <MessageScrollerProvider>
            <MessageScroller className="min-h-0 flex-1">
              <MessageScrollerViewport className="px-mogu-screen-x py-mogu-screen-y">
                <AgentChatTranscript />
              </MessageScrollerViewport>
            </MessageScroller>
            <AgentChatAutoScroll />
            <AgentChatComposer />
          </MessageScrollerProvider>
        </div>

        <AgentChatHistorySheet />
      </div>
    </AgentChatProvider>
  );
}

/** History sheet も open/close/select を Context から取る (#294)。 */
function AgentChatHistorySheet() {
  const { state, actions } = useAgentChatContext();

  return (
    <AgentConsultationHistorySheet
      open={state.historyOpen}
      onClose={actions.closeHistory}
      onSelect={(consultation) => actions.selectConsultation(consultation.id)}
    />
  );
}
