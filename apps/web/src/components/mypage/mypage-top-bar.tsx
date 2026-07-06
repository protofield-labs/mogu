"use client";

import { LogOut } from "lucide-react";

import { useAuth } from "@/contexts/auth-context";

export function MypageTopBar() {
  const { logout } = useAuth();

  return (
    <header className="flex items-center justify-between px-mogu-screen-x py-3">
      <span className="text-lg font-semibold tracking-tight text-foreground">
        mogu
      </span>
      <button
        type="button"
        onClick={() => void logout()}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-mogu-surface-elevated px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <LogOut className="size-3.5" aria-hidden />
        ログアウト
      </button>
    </header>
  );
}
