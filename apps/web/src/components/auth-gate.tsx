"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { AppShellSkeleton } from "@/components/loading/skeletons";
import { useAuth } from "@/contexts/auth-context";

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return <AppShellSkeleton label="認証状態を確認しています" />;
  }

  if (!user) {
    return null;
  }

  return children;
}
