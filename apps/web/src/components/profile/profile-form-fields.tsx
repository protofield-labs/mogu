"use client";

import { Check } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ONBOARDING_AVATAR_COLORS } from "@/lib/user-profile";
import { cn } from "@/lib/utils";

export type ProfileFormValues = {
  displayName: string;
  avatarColor: string;
};

type ProfileFormFieldsProps = {
  values: ProfileFormValues;
  onChange: (next: ProfileFormValues) => void;
  nameLabel?: string;
  colorLegend?: string;
  /** Hero card flip edit — fits inside a fixed-height card. */
  compact?: boolean;
};

export function ProfileFormFields({
  values,
  onChange,
  nameLabel = "名前",
  colorLegend = "アバターカラー",
  compact = false,
}: ProfileFormFieldsProps) {
  return (
    <>
      <Label className={compact ? "space-y-1" : undefined}>
        <span className={compact ? "text-xs" : undefined}>{nameLabel}</span>
        <Input
          type="text"
          required
          maxLength={100}
          autoComplete="name"
          value={values.displayName}
          onChange={(event) =>
            onChange({ ...values, displayName: event.target.value })
          }
          fieldSize={compact ? "sm" : "default"}
          placeholder="例: Ken"
        />
      </Label>

      <fieldset className={compact ? "space-y-1.5" : "space-y-3"}>
        <legend
          className={cn(
            "font-medium text-foreground",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {colorLegend}
        </legend>
        <div className={cn("grid", compact ? "grid-cols-8 gap-1" : "grid-cols-4 gap-3")}>
          {ONBOARDING_AVATAR_COLORS.map((color) => {
            const selected = values.avatarColor === color;
            return (
              <button
                key={color}
                type="button"
                aria-label={`${color} を選択`}
                aria-pressed={selected}
                onClick={() => onChange({ ...values, avatarColor: color })}
                className={cn(
                  "flex items-center justify-center border transition-transform",
                  compact
                    ? "size-6 rounded-md"
                    : "aspect-square rounded-2xl",
                  selected
                    ? "border-foreground ring-3 ring-ring/50"
                    : "border-border hover:scale-[1.03]",
                )}
                style={{ backgroundColor: color }}
              >
                {selected ? (
                  <Check
                    className={cn(
                      "text-white drop-shadow",
                      compact ? "size-3" : "size-5",
                    )}
                    aria-hidden
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </fieldset>
    </>
  );
}
