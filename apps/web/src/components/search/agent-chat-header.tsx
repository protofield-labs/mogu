"use client";

import {
  HistoryIcon,
  LoaderCircleIcon,
  MessageSquarePlusIcon,
  UsersIcon,
} from "lucide-react";

import { MoguHeaderLogo } from "@/components/brand/mogu-header-logo";
import { useAgentChatContext } from "@/components/search/agent-chat-context";
import { Button } from "@/components/ui/button";

export function AgentChatHeader() {
  const { state, actions } = useAgentChatContext();
  const { sessionStatus, loadingConsultation, sending, resettingConsultation } =
    state;
  return (
    <header className="flex shrink-0 items-center justify-between px-mogu-screen-x pt-4">
      <MoguHeaderLogo />
      {sessionStatus === "ready" ? (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="味覚アドバイザーの紹介"
            disabled={loadingConsultation || sending}
            onClick={actions.showPersonaIntroAgain}
            className="text-muted-foreground"
          >
            <UsersIcon className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={loadingConsultation || sending}
            onClick={actions.openHistory}
            className="text-muted-foreground"
          >
            <HistoryIcon className="size-4" aria-hidden />
            履歴
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={resettingConsultation || sending || loadingConsultation}
            onClick={actions.newConsultation}
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
        </div>
      ) : null}
    </header>
  );
}
