"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

import { getNotificationHref } from "@/lib/mypage/stats-row";
import { useMeBadges } from "@/lib/mypage/use-me-badges";

export function HomeNotificationButton() {
  const { badges, showBadge } = useMeBadges();
  const href = badges ? getNotificationHref(badges) : "/mypage/friends";

  return (
    <Link
      href={href}
      aria-label={showBadge ? "未読通知あり" : "通知"}
      className="relative flex size-9 items-center justify-center rounded-full border border-border bg-mogu-surface-elevated"
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
