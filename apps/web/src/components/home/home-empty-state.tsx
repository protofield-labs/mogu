"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { FRIENDS_FROM_HOME, friendsPagePath } from "@/lib/friends/paths";
import { cn } from "@/lib/utils";

export function HomeEmptyState() {
  return (
    <section className="mx-mogu-screen-x rounded-2xl border border-dashed border-border bg-mogu-surface-elevated px-mogu-screen-x py-8 text-center">
      <p className="text-sm font-medium text-foreground">
        まだ輪の出来事がありません
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        友達を招待するか、最初のお店を記録してフィードを育てましょう。
      </p>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Link
          href={friendsPagePath({ from: FRIENDS_FROM_HOME })}
          className={cn(buttonVariants({ variant: "secondary" }), "gap-1.5")}
        >
          <Plus className="size-4" aria-hidden />
          友達を招待
        </Link>
        <Link
          href="/mypage"
          className={cn(buttonVariants(), "gap-1.5")}
        >
          <Plus className="size-4" aria-hidden />
          最初のお店を追加
        </Link>
      </div>
    </section>
  );
}
