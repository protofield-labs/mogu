"use client";

import { GoogleIcon } from "@/components/auth/google-icon";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

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
    <Button
      type="button"
      variant="outline"
      size="cta"
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? (
        <Spinner />
      ) : (
        <GoogleIcon />
      )}
      {loading ? "ログイン中…" : "Googleで続ける"}
    </Button>
  );
}
