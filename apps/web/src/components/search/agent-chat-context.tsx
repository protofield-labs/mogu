"use client";

import { createContext, use, type FormEvent, type ReactNode } from "react";

import { useAuth } from "@/contexts/auth-context";
import { CANDIDATE_FOLLOWUP_TEXT } from "@/lib/agent/candidate-spot-markers";
import type { ChatEntry } from "@/lib/agent/chat-helpers";
import type { Spot } from "@/lib/agent/types";
import {
  useAgentChat,
  type ConsultationViewMode,
  type SessionStatus,
} from "@/lib/agent/use-agent-chat";
import { usePersonaIntro } from "@/lib/agent/use-persona-intro";

interface AgentChatState {
  sessionStatus: SessionStatus;
  entries: ChatEntry[];
  thinkingMessages: string[];
  input: string;
  initError: string | null;
  sendError: string | null;
  sending: boolean;
  retryingSession: boolean;
  resettingConsultation: boolean;
  historyOpen: boolean;
  consultationViewMode: ConsultationViewMode;
  loadingConsultation: boolean;
  inputDisabled: boolean;
  showInitialSkeleton: boolean;
  showStructuredChips: boolean;
  showPersonaIntro: boolean;
}

interface AgentChatActions {
  setInput: (value: string) => void;
  openHistory: () => void;
  closeHistory: () => void;
  selectConsultation: (consultationId: string) => void;
  retrySession: () => void;
  newConsultation: () => void;
  sendMessage: (text: string, chips?: string[]) => void;
  /** 候補カードタップ → 同一 place_id 固定のフォローアップを送る (#287)。 */
  sendCandidateFollowUp: (spot: Spot) => void;
  handleSubmit: (event: FormEvent) => void;
  handleChipSelect: (chip: string) => void;
  dismissPersonaIntro: () => void;
  showPersonaIntroAgain: () => void;
}

interface AgentChatMeta {
  /** Vertex session id。相談切替時の auto-scroll リセットに使う。 */
  sessionId: string | null;
}

interface AgentChatContextValue {
  state: AgentChatState;
  actions: AgentChatActions;
  meta: AgentChatMeta;
}

const AgentChatContext = createContext<AgentChatContextValue | null>(null);

/** useAgentChat / usePersonaIntro をここで束ね、子は use(AgentChatContext) で読む (#294)。 */
export function AgentChatProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const chat = useAgentChat(user?.uid ?? null, authLoading);
  const personaIntro = usePersonaIntro();

  const value: AgentChatContextValue = {
    state: {
      sessionStatus: chat.sessionStatus,
      entries: chat.entries,
      thinkingMessages: chat.thinkingMessages,
      input: chat.input,
      initError: chat.initError,
      sendError: chat.sendError,
      sending: chat.sending,
      retryingSession: chat.retryingSession,
      resettingConsultation: chat.resettingConsultation,
      historyOpen: chat.historyOpen,
      consultationViewMode: chat.consultationViewMode,
      loadingConsultation: chat.loadingConsultation,
      inputDisabled: chat.inputDisabled,
      showInitialSkeleton: chat.showInitialSkeleton,
      showStructuredChips: chat.showStructuredChips,
      showPersonaIntro: personaIntro.showPersonaIntro,
    },
    actions: {
      setInput: chat.setInput,
      openHistory: () => chat.setHistoryOpen(true),
      closeHistory: () => chat.setHistoryOpen(false),
      selectConsultation: (consultationId) => {
        void chat.applyConsultationDetail(consultationId);
      },
      retrySession: () => {
        void chat.handleRetrySession();
      },
      newConsultation: () => {
        void chat.handleNewConsultation();
      },
      sendMessage: (text, chips) => {
        void chat.sendMessage(text, chips);
      },
      sendCandidateFollowUp: (spot) => {
        void chat.sendMessage(CANDIDATE_FOLLOWUP_TEXT, undefined, {
          candidateSpot: { spotId: spot.id, placeId: spot.placeId },
        });
      },
      handleSubmit: chat.handleSubmit,
      handleChipSelect: chat.handleChipSelect,
      dismissPersonaIntro: personaIntro.dismissPersonaIntro,
      showPersonaIntroAgain: personaIntro.showPersonaIntroAgain,
    },
    meta: {
      sessionId: chat.sessionId,
    },
  };

  return <AgentChatContext value={value}>{children}</AgentChatContext>;
}

export function useAgentChatContext(): AgentChatContextValue {
  const context = use(AgentChatContext);
  if (!context) {
    throw new Error(
      "useAgentChatContext must be used within AgentChatProvider",
    );
  }
  return context;
}
