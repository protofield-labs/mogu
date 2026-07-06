"use client";

import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";

export function MypageTopBar() {
  const { logout } = useAuth();

  return (
    <header className="flex items-center justify-between gap-3 px-mogu-screen-x pt-4">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        プロフィール
      </h1>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => void logout()}
        aria-label="ログアウト"
        className="size-10 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <LogOut className="size-5" aria-hidden />
      </Button>
    </header>
  );
}
