"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { AppShellSkeleton } from "@/components/loading/skeletons";
import { authFetch } from "@/lib/auth/auth-fetch";
import { isOnboardingComplete } from "@/lib/user-profile";

type MeResponse = {
  user?: Profile;
};

type Profile = {
  displayName: string;
  avatarColor: string;
};

function unwrapProfile(data: MeResponse | Profile): Profile {
  return "user" in data && data.user ? data.user : (data as Profile);
}

export function OnboardingGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setStatus("loading");
      setError(null);

      try {
        const response = await authFetch("/api/v1/users/me");
        if (response.status === 404) {
          router.replace(`/onboarding?next=${encodeURIComponent(pathname)}`);
          return;
        }
        if (!response.ok) {
          throw new Error(`プロフィールを読み込めませんでした (${response.status})`);
        }

        const data = (await response.json()) as MeResponse | Profile;
        if (!isOnboardingComplete(unwrapProfile(data))) {
          router.replace(`/onboarding?next=${encodeURIComponent(pathname)}`);
          return;
        }

        if (!cancelled) {
          setStatus("ready");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "プロフィールを読み込めませんでした");
          setStatus("error");
        }
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (status === "ready") {
    return children;
  }

  if (status === "error") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-6 text-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  return <AppShellSkeleton label="プロフィールを確認しています" />;
}
