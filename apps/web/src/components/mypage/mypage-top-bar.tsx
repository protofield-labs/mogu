"use client";

import { LogOut } from "lucide-react";

import { MoguBrandIcon } from "@/components/brand/mogu-brand-icon";
import { MoguWordmark } from "@/components/brand/mogu-wordmark";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { touchRowClass } from "@/lib/ui/touch-feedback";
import { cn } from "@/lib/utils";

export function MypageTopBar() {
  const { logout } = useAuth();

  return (
    <header className="flex items-center justify-between px-mogu-screen-x pt-4">
      <div className="flex items-center gap-2">
        <MoguBrandIcon className="size-5" />
        <MoguWordmark as="h1" />
      </div>
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
