"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";

import { OnboardingFormSkeleton } from "@/components/loading/skeletons";
import {
  ProfileFormFields,
  type ProfileFormValues,
} from "@/components/profile/profile-form-fields";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/auth-context";
import { listMyCollections } from "@/lib/collections/browser-api";
import { setLastRecollectTarget } from "@/lib/recollect/last-target";
import { DEFAULT_COLLECTION_NAME } from "@/lib/recollect/constants";
import {
  DEFAULT_AVATAR_COLOR,
  ONBOARDING_AVATAR_COLORS,
  isOnboardingComplete,
} from "@/lib/user-profile";
import { createUserProfile, fetchUsersMe } from "@/lib/users/browser-api";

function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

function fallbackDisplayName(user: NonNullable<ReturnType<typeof useAuth>["user"]>) {
  return user.displayName ?? user.email?.split("@")[0] ?? "";
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const nextPath = useMemo(
    () => safeNextPath(searchParams.get("next")),
    [searchParams],
  );
  const [form, setForm] = useState<ProfileFormValues>({
    displayName: "",
    avatarColor: ONBOARDING_AVATAR_COLORS[0],
  });
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
        const profile = await fetchUsersMe();
        if (!profile) {
          if (!cancelled) {
            setForm((current) => ({
              ...current,
              displayName: fallbackDisplayName(currentUser),
            }));
          }
          return;
        }

        if (isOnboardingComplete(profile)) {
          router.replace(nextPath);
          return;
        }

        if (!cancelled) {
          setForm({
            displayName: profile.displayName,
            avatarColor:
              profile.avatarColor !== DEFAULT_AVATAR_COLOR
                ? profile.avatarColor
                : ONBOARDING_AVATAR_COLORS[0],
          });
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
      await createUserProfile(form);
      try {
        const collections = await listMyCollections();
        const defaultCollection =
          collections.find((item) => item.name === DEFAULT_COLLECTION_NAME) ??
          collections[0] ??
          null;
        if (defaultCollection) {
          setLastRecollectTarget({
            collectionId: defaultCollection.id,
            collectionName: defaultCollection.name,
          });
        }
      } catch {
        // profile saved; default shelf seeding is best-effort on client
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
            <ProfileFormFields values={form} onChange={setForm} />

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button type="submit" size="cta" disabled={submitting}>
              {submitting ? (
                <>
                  <Spinner />
                  保存しています…
                </>
              ) : (
                "mogu を始める"
              )}
            </Button>
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
