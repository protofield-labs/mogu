"use client";

import Link from "next/link";

import { useAuth } from "@/contexts/auth-context";

export function AppHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="flex items-center justify-between border-b border-border px-mogu-screen-x py-3">
      <Link href="/" className="font-semibold text-foreground">
        mogu
      </Link>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        {user?.email ? <span className="max-w-40 truncate">{user.email}</span> : null}
        <button
          type="button"
          onClick={() => void logout()}
          className="font-medium text-foreground hover:underline"
        >
          ログアウト
        </button>
      </div>
    </header>
  );
}
