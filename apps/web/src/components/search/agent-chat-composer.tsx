"use client";

import { SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useVisualViewportOffset } from "@/lib/ui/use-visual-viewport-offset";
import { cn } from "@/lib/utils";

type AgentChatComposerProps = {
  input: string;
  inputDisabled: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onSend: (text: string) => void;
};

export function AgentChatComposer({
  input,
  inputDisabled,
  onInputChange,
  onSubmit,
  onSend,
}: AgentChatComposerProps) {
  const keyboardOffset = useVisualViewportOffset();

  return (
    <footer
      className={cn(
        "shrink-0 border-t border-border px-mogu-screen-x pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 transition-transform duration-150 ease-out motion-reduce:transition-none",
      )}
      style={
        keyboardOffset > 0
          ? { transform: `translateY(-${keyboardOffset}px)` }
          : undefined
      }
    >
      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <label className="sr-only" htmlFor="agent-message-input">
          メッセージ
        </label>
        <textarea
          id="agent-message-input"
          rows={1}
          value={input}
          disabled={inputDisabled}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend(input);
            }
          }}
          placeholder="メッセージを入力..."
          className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-border bg-mogu-surface-elevated px-4 py-2.5 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        />
        <Button
          type="submit"
          size="icon"
          className="size-10 shrink-0 rounded-full"
          disabled={inputDisabled || !input.trim()}
          aria-label="送信"
        >
          <SparklesIcon className="size-4" />
        </Button>
      </form>
    </footer>
  );
}
