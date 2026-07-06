"use client";

import { LoaderCircleIcon } from "lucide-react";

import { GoogleIcon } from "@/components/auth/google-icon";

type GoogleSignInButtonProps = {
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
};

export function GoogleSignInButton({
  disabled,
  loading,
  onClick,
}: GoogleSignInButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className="flex h-11 w-full items-center justify-center gap-3 rounded-2xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
    >
      {loading ? (
        <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
      ) : (
        <GoogleIcon />
      )}
      {loading ? "ログイン中…" : "Googleで続ける"}
    </button>
  );
}
