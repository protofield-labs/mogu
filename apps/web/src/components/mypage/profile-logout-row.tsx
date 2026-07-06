"use client";

import { ChevronRight, LogOut } from "lucide-react";

import { useAuth } from "@/contexts/auth-context";

/** Standalone logout row (#103) — no settings accordion wrapper. */
export function ProfileLogoutRow() {
  const { logout } = useAuth();

  return (
    <section className="px-mogu-screen-x">
      <button
        type="button"
        onClick={() => void logout()}
        className="flex w-full items-center gap-3 rounded-mogu-card bg-mogu-surface-elevated p-4 text-left shadow-sm transition-colors hover:bg-muted/40"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <LogOut className="size-4.5" aria-hidden />
        </span>
        <span className="flex-1 text-sm font-medium text-foreground">ログアウト</span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    </section>
  );
}
