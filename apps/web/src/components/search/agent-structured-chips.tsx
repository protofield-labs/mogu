"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  buildStructuredChipPrompt,
  STRUCTURED_CHIP_GROUPS,
  structuredSelectionsToChips,
  type StructuredChipSelections,
} from "@/lib/agent/structured-chips";
import { filterPillClass } from "@/lib/ui/filter-pill";

type AgentStructuredChipsProps = {
  disabled?: boolean;
  onSend: (text: string, chips: string[]) => void;
};

export function AgentStructuredChips({
  disabled = false,
  onSend,
}: AgentStructuredChipsProps) {
  const [selections, setSelections] = useState<StructuredChipSelections>({});

  const chips = structuredSelectionsToChips(selections);
  const prompt = buildStructuredChipPrompt(selections);

  function toggleOption(groupId: string, option: string) {
    setSelections((current) => {
      const next = { ...current };
      if (next[groupId] === option) {
        delete next[groupId];
      } else {
        next[groupId] = option;
      }
      return next;
    });
  }

  function handleSend() {
    if (!prompt || chips.length === 0) {
      return;
    }
    onSend(prompt, chips);
    setSelections({});
  }

  return (
    <div className="mt-3 space-y-3">
      {STRUCTURED_CHIP_GROUPS.map((group) => (
        <div key={group.id}>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            {group.label}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.options.map((option) => {
              const selected = selections[group.id] === option;
              return (
                <button
                  key={`${group.id}-${option}`}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  onClick={() => toggleOption(group.id, option)}
                  className={filterPillClass(selected)}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        disabled={disabled || chips.length === 0}
        onClick={handleSend}
        className="rounded-full"
      >
        この条件で相談
      </Button>
    </div>
  );
}
