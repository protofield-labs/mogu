"use client";

import { LogOut } from "lucide-react";

import { MoguHeaderLogo } from "@/components/brand/mogu-header-logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { touchRowClass } from "@/lib/ui/touch-feedback";
import { cn } from "@/lib/utils";

export function MypageTopBar() {
  const { logout } = useAuth();

  return (
    <header className="flex items-center justify-between px-mogu-screen-x pt-4">
      <MoguHeaderLogo />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="ログアウト"
        className={cn(touchRowClass)}
        onClick={() => void logout()}
      >
        <LogOut className="size-5" aria-hidden />
      </Button>
    </header>
  );
}
