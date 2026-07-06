"use client";

import { LoaderCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LoadErrorStateProps = {
  message: string;
  onRetry: () => void;
  retrying?: boolean;
  variant?: "page" | "inline";
  className?: string;
};

export function LoadErrorState({
  message,
  onRetry,
  retrying = false,
  variant = "page",
  className,
}: LoadErrorStateProps) {
  const retryLabel = retrying ? (
    <>
      <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
      読み込み中…
    </>
  ) : (
    "再読み込み"
  );

  if (variant === "inline") {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-2xl border border-border bg-mogu-surface-elevated px-4 py-3",
          className,
        )}
        role="alert"
      >
        <span className="text-sm text-muted-foreground">{message}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={retrying}
          onClick={onRetry}
        >
          {retryLabel}
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-4 px-mogu-screen-x py-mogu-screen-y text-center",
        className,
      )}
    >
      <p className="text-sm text-destructive" role="alert">
        {message}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={retrying}
        onClick={onRetry}
      >
        {retryLabel}
      </Button>
    </div>
  );
}
