"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import {
  AuthErrorMessage,
  AuthFormField,
  AuthFormShell,
  AuthPasswordField,
} from "@/components/auth/auth-form";
import { AuthFormSkeleton } from "@/components/loading/skeletons";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/auth-context";
import { getAuthErrorMessage, signUpWithEmail } from "@/lib/auth/client-auth";

export default function SignupPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && !submitting) {
      router.replace("/");
    }
  }, [user, loading, submitting, router]);

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signUpWithEmail(email, password, displayName);
      router.replace("/onboarding");
    } catch (err) {
      setError(getAuthErrorMessage(err, "signup"));
      setSubmitting(false);
    }
  }

  if (loading || user) {
    return <AuthFormSkeleton label="アカウント状態を確認しています" />;
  }

  return (
    <AuthFormShell
      title="mogu をはじめよう"
      description="アカウントを作成して、食の記録をはじめましょう。"
      submitting={submitting}
      footer={
        <p className="text-center text-sm text-muted-foreground">
          すでにアカウントをお持ちの方は{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
          >
            ログイン
          </Link>
        </p>
      }
    >
      <form className="space-y-4" onSubmit={(e) => void handleSignUp(e)}>
        <AuthFormField
          label="表示名"
          type="text"
          required
          maxLength={100}
          autoComplete="name"
          disabled={submitting}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
        <AuthFormField
          label="メールアドレス"
          type="email"
          required
          autoComplete="email"
          disabled={submitting}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <AuthPasswordField
          label="パスワード"
          autoComplete="new-password"
          disabled={submitting}
          minLength={6}
          value={password}
          onChange={setPassword}
          hint="6文字以上で設定してください"
        />
        {error ? <AuthErrorMessage message={error} /> : null}
        <Button type="submit" size="cta" disabled={submitting}>
          {submitting ? (
            <>
              <Spinner />
              アカウント作成中…
            </>
          ) : (
            "アカウントを作成"
          )}
        </Button>
      </form>
    </AuthFormShell>
  );
}
