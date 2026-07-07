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
import { Button } from "@/components/ui/button";
import { RecommendationCard } from "@/components/search/recommendation-card";
import {
  formatUserBubbleText,
  type ChatEntry,
} from "@/lib/agent/chat-helpers";

export function AgentAvatar() {
  return (
    <MessageAvatar className="size-8 bg-mogu-surface-elevated text-foreground">
      <MoguBrandIcon className="size-4" />
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
  onChipSelect: (chip: string) => void;
  disabled: boolean;
}) {
  return (
    <Message align="start">
      <AgentAvatar />
      <MessageContent>
        <BubbleGroup>
          <Bubble variant="outline" align="start">
            <BubbleContent>
              <p className="whitespace-pre-wrap">{entry.text}</p>
              {entry.quickReplies?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {entry.quickReplies.map((chip) => (
                    <Button
                      key={chip}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={disabled}
                      onClick={() => onChipSelect(chip)}
                    >
                      {chip}
                    </Button>
                  ))}
                </div>
              ) : null}
            </BubbleContent>
          </Bubble>
        </BubbleGroup>
        {entry.recommendation ? (
          <RecommendationCard recommendation={entry.recommendation} />
        ) : null}
      </MessageContent>
    </Message>
  );
}
