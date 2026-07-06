"use client";

import { type ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { useMeBadges } from "@/lib/mypage/use-me-badges";

type ProtectedAppShellProps = {
  children: ReactNode;
};

export function ProtectedAppShell({ children }: ProtectedAppShellProps) {
  const { showBadge } = useMeBadges();

  return <AppShell showMypageBadge={showBadge}>{children}</AppShell>;
}
