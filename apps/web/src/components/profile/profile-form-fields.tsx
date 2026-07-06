"use client";

import { Check } from "lucide-react";

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
};

export function ProfileFormFields({
  values,
  onChange,
  nameLabel = "名前",
  colorLegend = "アバターカラー",
}: ProfileFormFieldsProps) {
  return (
    <>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-foreground">{nameLabel}</span>
        <input
          type="text"
          required
          maxLength={100}
          autoComplete="name"
          value={values.displayName}
          onChange={(event) =>
            onChange({ ...values, displayName: event.target.value })
          }
          className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          placeholder="例: Ken"
        />
      </label>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-foreground">
          {colorLegend}
        </legend>
        <div className="grid grid-cols-4 gap-3">
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
                  "flex aspect-square items-center justify-center rounded-2xl border transition-transform",
                  selected
                    ? "border-foreground ring-3 ring-ring/50"
                    : "border-border hover:scale-[1.03]",
                )}
                style={{ backgroundColor: color }}
              >
                {selected ? (
                  <Check
                    className="size-5 text-white drop-shadow"
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
