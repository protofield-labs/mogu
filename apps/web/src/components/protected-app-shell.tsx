"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { fetchMeBadges } from "@/lib/mypage/browser-api";
import { shouldShowMypageTabBadge } from "@/lib/mypage/stats-row";

type ProtectedAppShellProps = {
  children: ReactNode;
};

export function ProtectedAppShell({ children }: ProtectedAppShellProps) {
  const pathname = usePathname();
  const [showMypageBadge, setShowMypageBadge] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadBadges() {
      try {
        const badges = await fetchMeBadges();
        if (!cancelled) {
          setShowMypageBadge(shouldShowMypageTabBadge(badges));
        }
      } catch {
        if (!cancelled) {
          setShowMypageBadge(false);
        }
      }
    }

    void loadBadges();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return <AppShell showMypageBadge={showMypageBadge}>{children}</AppShell>;
}
