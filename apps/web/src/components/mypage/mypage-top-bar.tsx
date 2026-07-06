"use client";

import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";

export function MypageTopBar() {
  const { logout } = useAuth();

  return (
    <header className="flex items-center justify-between px-mogu-screen-x py-3">
      <span className="text-lg font-semibold tracking-tight text-foreground">
        mogu
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="ログアウト"
        onClick={() => void logout()}
        className="text-muted-foreground hover:text-foreground"
      >
        <LogOut className="size-4" aria-hidden />
      </Button>
    </header>
  );
}
