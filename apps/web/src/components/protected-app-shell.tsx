"use client";

import { type ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import {
  MeBadgesProvider,
  useMeBadges,
} from "@/lib/mypage/use-me-badges";

type ProtectedAppShellProps = {
  children: ReactNode;
};

export function ProtectedAppShell({ children }: ProtectedAppShellProps) {
  return (
    <MeBadgesProvider>
      <ProtectedAppShellInner>{children}</ProtectedAppShellInner>
    </MeBadgesProvider>
  );
}

function ProtectedAppShellInner({ children }: ProtectedAppShellProps) {
  const { showBadge } = useMeBadges();

  return <AppShell showMypageBadge={showBadge}>{children}</AppShell>;
}
