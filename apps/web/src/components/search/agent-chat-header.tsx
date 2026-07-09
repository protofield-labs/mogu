"use client";

import {
  HistoryIcon,
  LoaderCircleIcon,
  MessageSquarePlusIcon,
  UsersIcon,
} from "lucide-react";

import { MoguBrandIcon } from "@/components/brand/mogu-brand-icon";
import { MoguWordmark } from "@/components/brand/mogu-wordmark";
import { Button } from "@/components/ui/button";
import type { SessionStatus } from "@/lib/agent/use-agent-chat";

type AgentChatHeaderProps = {
  sessionStatus: SessionStatus;
  loadingConsultation: boolean;
  sending: boolean;
  resettingConsultation: boolean;
  onOpenHistory: () => void;
  onNewConsultation: () => void;
  onShowPersonaIntro: () => void;
};

export function AgentChatHeader({
  sessionStatus,
  loadingConsultation,
  sending,
  resettingConsultation,
  onOpenHistory,
  onNewConsultation,
  onShowPersonaIntro,
}: AgentChatHeaderProps) {
  return (
    <header className="flex shrink-0 items-center justify-between px-mogu-screen-x py-3">
      <div className="flex items-center gap-2">
        <MoguBrandIcon className="size-5" />
        <MoguWordmark as="h1" />
      </div>
      {sessionStatus === "ready" ? (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="味覚アドバイザーの紹介"
            disabled={loadingConsultation || sending}
            onClick={onShowPersonaIntro}
            className="text-muted-foreground"
          >
            <UsersIcon className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={loadingConsultation || sending}
            onClick={onOpenHistory}
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
            onClick={onNewConsultation}
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
