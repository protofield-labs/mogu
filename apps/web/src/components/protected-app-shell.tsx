"use client";

import { type ReactNode } from "react";

import { AppShell } from "@/components/app-shell";

type ProtectedAppShellProps = {
  children: ReactNode;
};

export function ProtectedAppShell({ children }: ProtectedAppShellProps) {
  return <AppShell>{children}</AppShell>;
}
