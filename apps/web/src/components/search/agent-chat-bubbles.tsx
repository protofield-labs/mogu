"use client";

import { MoguBrandIcon } from "@/components/brand/mogu-brand-icon";
import {
  Bubble,
  BubbleContent,
  BubbleGroup,
  Message,
  MessageAvatar,
  MessageContent,
} from "@/components/chat";
import { AgentCandidateSpotCards } from "@/components/search/agent-candidate-spot-cards";
import { RecommendationCard } from "@/components/search/recommendation-card";
import { filterPillClass } from "@/lib/ui/filter-pill";
import {
  formatUserBubbleText,
  toPublicChatEntry,
  type ChatEntry,
} from "@/lib/agent/chat-helpers";

export function AgentAvatar() {
  return (
    <MessageAvatar
      className="size-8 overflow-visible bg-transparent text-foreground"
      aria-label="mogu"
    >
      <MoguBrandIcon className="size-8" />
    </MessageAvatar>
  );
}

export function TypingIndicator() {
  return (
    <Message align="start">
      <AgentAvatar />
      <MessageContent>
        <BubbleGroup>
          <Bubble variant="outline" align="start">
            <BubbleContent aria-live="polite" aria-label="考え中">
              <span className="flex items-center gap-1 py-1">
                <span className="size-2 rounded-full bg-muted-foreground/60 motion-safe:animate-bounce [animation-delay:-0.3s]" />
                <span className="size-2 rounded-full bg-muted-foreground/60 motion-safe:animate-bounce [animation-delay:-0.15s]" />
                <span className="size-2 rounded-full bg-muted-foreground/60 motion-safe:animate-bounce" />
              </span>
            </BubbleContent>
          </Bubble>
        </BubbleGroup>
      </MessageContent>
    </Message>
  );
}

export function UserBubble({ entry }: { entry: Extract<ChatEntry, { kind: "user" }> }) {
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

export function AgentBubble({
  entry,
  onChipSelect,
  disabled,
}: {
  entry: Extract<ChatEntry, { kind: "agent" }>;
  onChipSelect: (chip: string, displayText?: string) => void;
  disabled: boolean;
}) {
  const publicEntry = toPublicChatEntry(entry);

  return (
    <Message align="start">
      <AgentAvatar />
      <MessageContent>
        <BubbleGroup>
          <Bubble variant="outline" align="start">
            <BubbleContent>
              <p className="whitespace-pre-wrap">{publicEntry.text}</p>
              {publicEntry.quickReplies?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {publicEntry.quickReplies.map((chip, index) => (
                    <button
                      key={entry.quickReplies?.[index] ?? chip}
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        onChipSelect(entry.quickReplies?.[index] ?? chip, chip)
                      }
                      className={filterPillClass(false)}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              ) : null}
            </BubbleContent>
          </Bubble>
        </BubbleGroup>
        {publicEntry.recommendation ? (
          <RecommendationCard recommendation={publicEntry.recommendation} />
        ) : null}
        {publicEntry.candidateSpots?.length ? (
          <AgentCandidateSpotCards spots={publicEntry.candidateSpots} />
        ) : null}
      </MessageContent>
    </Message>
  );
}
