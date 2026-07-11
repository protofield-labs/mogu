"use client";

import { useCallback, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";

import { sendAgentTurn, type SendTurnResult } from "@/lib/agent/send-turn";
import {
  createUserEntry,
  formatAgentUserError,
  isAgentSessionUnavailableError,
  type ChatEntry,
} from "@/lib/agent/chat-helpers";
import type { CandidateSpotRef } from "@/lib/agent/types";

type UseAgentSendOptions = {
  userId: string | null;
  sessionId: string | null;
  entriesRef: React.RefObject<ChatEntry[]>;
  setEntries: Dispatch<SetStateAction<ChatEntry[]>>;
  invalidateStoredSession: () => void;
};

export function useAgentSend(options: UseAgentSendOptions) {
  const { userId, sessionId, entriesRef, setEntries, invalidateStoredSession } =
    options;

  const [input, setInput] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [thinkingMessages, setThinkingMessages] = useState<string[]>([]);
  const sendingRef = useRef(false);

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
    [invalidateStoredSession, setEntries],
  );

  const sendMessage = useCallback(
    async (
      text: string,
      chips?: string[],
      sendOptions?: { candidateSpot?: CandidateSpotRef },
    ) => {
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
        sendingRef.current = false;
        setSending(false);
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
          candidateSpot: sendOptions?.candidateSpot,
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
    [sessionId, userId, applySendTurnResult, entriesRef, setEntries],
  );

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void sendMessage(input);
  }

  function handleChipSelect(chip: string) {
    void sendMessage(chip);
  }

  return {
    input,
    setInput,
    sendError,
    setSendError,
    sending,
    setSending,
    thinkingMessages,
    setThinkingMessages,
    sendingRef,
    applySendTurnResult,
    sendMessage,
    handleSubmit,
    handleChipSelect,
  };
}
