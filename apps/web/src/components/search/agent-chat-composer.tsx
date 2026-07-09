"use client";

import { useRef } from "react";
import { ArrowUp } from "lucide-react";

import { useAgentChatContext } from "@/components/search/agent-chat-context";
import { Button } from "@/components/ui/button";
import { useVisualViewportOffset } from "@/lib/ui/use-visual-viewport-offset";
import { cn } from "@/lib/utils";

export function AgentChatComposer() {
  const { state, actions } = useAgentChatContext();
  const { input, inputDisabled } = state;
  const keyboardOffset = useVisualViewportOffset();
  // Chrome は IME 確定 Enter で compositionend → keydown の順になり、
  // keydown 時点では isComposing が false になる (#250)。
  const skipEnterAfterCompositionRef = useRef(false);

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
      <form onSubmit={actions.handleSubmit} className="flex items-end gap-2">
        <label className="sr-only" htmlFor="agent-message-input">
          メッセージ
        </label>
        <textarea
          id="agent-message-input"
          rows={1}
          value={input}
          disabled={inputDisabled}
          onChange={(event) => actions.setInput(event.target.value)}
          onCompositionEnd={() => {
            skipEnterAfterCompositionRef.current = true;
            // マウス/タップ確定では Enter keydown が来ない。macrotask で keydown 後にクリア。
            window.setTimeout(() => {
              skipEnterAfterCompositionRef.current = false;
            }, 0);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              // IME 変換確定の Enter では送信しない（#250）。
              // keyCode 229 は isComposing を立てないブラウザ向け。
              // skipEnterAfterCompositionRef は Chrome の compositionend→keydown 順向け。
              const skipImeConfirm =
                event.nativeEvent.isComposing ||
                event.keyCode === 229 ||
                skipEnterAfterCompositionRef.current;
              skipEnterAfterCompositionRef.current = false;
              if (skipImeConfirm) {
                return;
              }
              event.preventDefault();
              actions.sendMessage(input);
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
          <ArrowUp className="size-4" aria-hidden />
        </Button>
      </form>
    </footer>
  );
}
