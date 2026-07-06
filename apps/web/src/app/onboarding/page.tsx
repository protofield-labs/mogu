"use client";

import { Check, LoaderCircleIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";

import { OnboardingFormSkeleton } from "@/components/loading/skeletons";
import { useAuth } from "@/contexts/auth-context";
import { parseApiErrorBody } from "@/lib/auth/api-error";
import { authFetch } from "@/lib/auth/auth-fetch";
import {
  ONBOARDING_AVATAR_COLORS,
  isOnboardingComplete,
} from "@/lib/user-profile";
import { cn } from "@/lib/utils";

type MeResponse = {
  user?: Profile;
};

type Profile = {
  displayName: string;
  avatarColor: string;
};

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

function fallbackDisplayName(user: NonNullable<ReturnType<typeof useAuth>["user"]>) {
  return user.displayName ?? user.email?.split("@")[0] ?? "";
}

function unwrapProfile(data: MeResponse | Profile): Profile {
  return "user" in data && data.user ? data.user : (data as Profile);
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const nextPath = useMemo(
    () => safeNextPath(searchParams.get("next")),
    [searchParams],
  );
  const [displayName, setDisplayName] = useState("");
  const [avatarColor, setAvatarColor] = useState<string>(
    ONBOARDING_AVATAR_COLORS[0],
  );
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    const currentUser = user;
    let cancelled = false;

    async function loadProfile() {
      setLoadingProfile(true);
      setError(null);

      try {
        const response = await authFetch("/api/v1/users/me");
        if (response.status === 404) {
          if (!cancelled) {
            setDisplayName(fallbackDisplayName(currentUser));
          }
          return;
        }
        if (!response.ok) {
          const body = await parseApiErrorBody(response);
          throw new Error(body?.error.message ?? "プロフィールを読み込めませんでした");
        }

        const data = (await response.json()) as MeResponse | Profile;
        const profile = unwrapProfile(data);
        if (isOnboardingComplete(profile)) {
          router.replace(nextPath);
          return;
        }

        if (!cancelled) {
          setDisplayName(profile.displayName);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "プロフィールを読み込めませんでした");
        }
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [user, loading, router, nextPath]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await authFetch("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, avatarColor }),
      });

      if (!response.ok) {
        const body = await parseApiErrorBody(response);
        throw new Error(body?.error.message ?? "プロフィールを保存できませんでした");
      }

      router.replace(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "プロフィールを保存できませんでした");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !user || loadingProfile) {
    return <OnboardingFormSkeleton />;
  }

  return (
    <main className="flex min-h-dvh justify-center bg-background">
      <div className="flex min-h-dvh w-full max-w-mogu-shell flex-col justify-center px-6 py-10">
        <div className="rounded-3xl border border-border bg-mogu-surface-elevated p-6 shadow-sm">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              はじめに
            </p>
            <h1 className="text-2xl font-semibold text-foreground">
              mogu のプロフィールを作成
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              友達に表示される名前と、あなたのアバターカラーを設定します。
            </p>
          </div>

          <form className="mt-6 space-y-6" onSubmit={(e) => void handleSubmit(e)}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-foreground">名前</span>
              <input
                type="text"
                required
                maxLength={100}
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder="例: Ken"
              />
            </label>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-foreground">
                アバターカラー
              </legend>
              <div className="grid grid-cols-4 gap-3">
                {ONBOARDING_AVATAR_COLORS.map((color) => {
                  const selected = avatarColor === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      aria-label={`${color} を選択`}
                      aria-pressed={selected}
                      onClick={() => setAvatarColor(color)}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-2xl border transition-transform",
                        selected
                          ? "border-foreground ring-3 ring-ring/50"
                          : "border-border hover:scale-[1.03]",
                      )}
                      style={{ backgroundColor: color }}
                    >
                      {selected ? (
                        <Check
                          className="size-5 text-white drop-shadow"
                          aria-hidden
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <button
              type="submit"
              disabled={submitting}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
                  保存しています…
                </>
              ) : (
                "mogu を始める"
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingFormSkeleton />}>
      <OnboardingContent />
    </Suspense>
  );
}
