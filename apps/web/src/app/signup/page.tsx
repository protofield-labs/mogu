"use client";

import { LoaderCircleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { AuthFormSkeleton } from "@/components/loading/skeletons";
import { useAuth } from "@/contexts/auth-context";
import {
  getAuthErrorMessage,
  signUpWithEmail,
} from "@/lib/auth/client-auth";
import { cn } from "@/lib/utils";

export default function SignupPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Skip while submitting: onIdTokenChanged sets user before provisioning
  // finishes, and redirecting then lets /api/v1/users/me race the upsert.
  // The submit handler redirects after provisionUser resolves.
  useEffect(() => {
    if (!loading && user && !submitting) {
      router.replace("/");
    }
  }, [user, loading, submitting, router]);

  // On success, keep `submitting` true so the effect above cannot race the
  // handler navigation with a redirect to "/"; the page unmounts on replace.
  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signUpWithEmail(email, password, displayName);
      router.replace("/onboarding");
    } catch (err) {
      setError(getAuthErrorMessage(err));
      setSubmitting(false);
    }
  }

  if (loading || user) {
    return <AuthFormSkeleton label="アカウント状態を確認しています" />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div
        className={cn(
          "relative w-full max-w-md space-y-6 rounded-3xl border border-border bg-mogu-surface-elevated p-8 shadow-sm transition-opacity",
          submitting && "pointer-events-none opacity-60",
        )}
      >
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold text-foreground">Sign up</h1>
          <p className="text-sm text-muted-foreground">Create your mogu account</p>
        </div>

        <form className="space-y-4" onSubmit={(e) => void handleSignUp(e)}>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-foreground">
              Display name
            </span>
            <input
              type="text"
              required
              maxLength={100}
              autoComplete="name"
              disabled={submitting}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="h-10 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-foreground">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              disabled={submitting}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-foreground">Password</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              disabled={submitting}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 w-full rounded-2xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            />
          </label>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
                アカウント作成中…
              </>
            ) : (
              "Create account"
            )}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
