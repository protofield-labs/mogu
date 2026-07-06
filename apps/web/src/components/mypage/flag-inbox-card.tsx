"use client";

import { Lock } from "lucide-react";

import {
  formatAnonymousFlagLine,
  formatNamedFlagLine,
  formatWeeklyHeadline,
  shouldShowFlagInbox,
  type WeeklyFlagSummary,
} from "@/lib/mypage/flag-inbox";

type FlagInboxCardProps = {
  summary: WeeklyFlagSummary;
};

function AvatarPlaceholder({
  label,
  anonymous = false,
}: {
  label: string;
  anonymous?: boolean;
}) {
  return (
    <span
      className={
        anonymous
          ? "flex size-8 items-center justify-center rounded-full border border-dashed border-border bg-background text-xs font-medium text-muted-foreground"
          : "flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
      }
      aria-hidden
    >
      {label}
    </span>
  );
}

export function FlagInboxCard({ summary }: FlagInboxCardProps) {
  if (!shouldShowFlagInbox(summary)) {
    return null;
  }

  return (
    <section
      className="mx-mogu-screen-x rounded-3xl bg-mogu-surface-elevated p-4 shadow-sm"
      aria-label="フラグ受信箱"
    >
      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Lock className="size-3.5" aria-hidden />
        あなただけに表示
      </p>
      <p className="mt-3 text-sm font-semibold text-foreground">
        {formatWeeklyHeadline(summary.totalCount)}
      </p>

      <ul className="mt-4 space-y-3">
        {summary.namedCount > 0 ? (
          <li className="flex items-center gap-3">
            <AvatarPlaceholder label="友" />
            <span className="h-2 flex-1 rounded-full bg-muted" aria-hidden />
            <span className="text-xs text-muted-foreground">
              {formatNamedFlagLine(summary.namedCount)}
            </span>
          </li>
        ) : null}
        {summary.anonymousRows.map((row) => (
          <li key={`anon-${row.weekOf}-${row.count}`} className="flex items-center gap-3">
            <AvatarPlaceholder label="?" anonymous />
            <span className="text-xs text-muted-foreground">
              {formatAnonymousFlagLine(row.count)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
