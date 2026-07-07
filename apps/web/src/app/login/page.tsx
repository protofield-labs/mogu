"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import {
  AuthDivider,
  AuthErrorMessage,
  AuthFormField,
  AuthFormShell,
  AuthPasswordField,
} from "@/components/auth/auth-form";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { AuthFormSkeleton } from "@/components/loading/skeletons";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/auth-context";
import {
  getAuthErrorMessage,
  signInWithEmail,
  signInWithGoogle,
} from "@/lib/auth/client-auth";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const busy = submitting || googleSubmitting;

  useEffect(() => {
    if (!loading && user && !busy) {
      router.replace("/");
    }
  }, [user, loading, busy, router]);

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleSubmitting(true);
    try {
      await signInWithGoogle();
      router.replace("/onboarding");
    } catch (err) {
      setError(getAuthErrorMessage(err, "login"));
      setGoogleSubmitting(false);
    }
  }

  async function handleEmailSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmail(email, password);
      router.replace("/onboarding");
    } catch (err) {
      setError(getAuthErrorMessage(err, "login"));
      setSubmitting(false);
    }
  }

  if (loading || user) {
    return <AuthFormSkeleton />;
  }

  return (
    <AuthFormShell
      eyebrow="mogu"
      title="ログイン"
      description="友達の食の記録と、AI の店づけにアクセスします。"
      submitting={busy}
      footer={
        <p className="text-center text-sm text-muted-foreground">
          アカウントをお持ちでない方は{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            新規登録
          </Link>
        </p>
      }
    >
      <GoogleSignInButton
        disabled={submitting}
        loading={googleSubmitting}
        onClick={() => void handleGoogleSignIn()}
      />

      <AuthDivider />

      <form className="space-y-4" onSubmit={(e) => void handleEmailSignIn(e)}>
        <AuthFormField
          label="メールアドレス"
          type="email"
          required
          autoComplete="email"
          disabled={busy}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <AuthPasswordField
          label="パスワード"
          autoComplete="current-password"
          disabled={busy}
          value={password}
          onChange={setPassword}
        />
        {error ? <AuthErrorMessage message={error} /> : null}
        <Button type="submit" size="cta" disabled={busy}>
          {submitting ? (
            <>
              <Spinner />
              ログイン中…
            </>
          ) : (
            "メールアドレスでログイン"
          )}
        </Button>
      </form>
    </AuthFormShell>
  );
}
