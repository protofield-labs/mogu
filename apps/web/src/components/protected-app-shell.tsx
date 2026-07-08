"use client";

import { type ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { MeBadgesProvider } from "@/lib/mypage/use-me-badges";

type ProtectedAppShellProps = {
  children: ReactNode;
};

export function ProtectedAppShell({ children }: ProtectedAppShellProps) {
  return (
    <MeBadgesProvider>
      <AppShell>{children}</AppShell>
    </MeBadgesProvider>
  );
}
