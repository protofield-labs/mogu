"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

import { getNotificationHref } from "@/lib/mypage/stats-row";
import { useMeBadges } from "@/lib/mypage/use-me-badges";

const bellButtonClassName =
  "relative flex size-9 items-center justify-center rounded-full border border-border bg-mogu-surface-elevated";

export function HomeNotificationButton() {
  const { badges, showBadge } = useMeBadges();

  if (!badges) {
    return (
      <span
        aria-busy="true"
        aria-label="通知を読み込んでいます"
        className={bellButtonClassName}
      >
        <Bell className="size-5 text-muted-foreground" aria-hidden />
      </span>
    );
  }

  const href = getNotificationHref(badges);

  return (
    <Link
      href={href}
      aria-label={showBadge ? "未読通知あり" : "通知"}
      className={bellButtonClassName}
    >
      <Bell className="size-5 text-foreground" aria-hidden />
      {showBadge ? (
        <span
          className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-mogu-badge"
          aria-hidden
        />
      ) : null}
    </Link>
  );
}
