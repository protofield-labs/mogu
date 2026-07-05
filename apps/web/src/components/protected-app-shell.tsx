"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { BADGES_UPDATED_EVENT } from "@/lib/mypage/badge-events";
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

    const handleBadgesUpdated = () => {
      void loadBadges();
    };
    window.addEventListener(BADGES_UPDATED_EVENT, handleBadgesUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener(BADGES_UPDATED_EVENT, handleBadgesUpdated);
    };
  }, [pathname]);

  return <AppShell showMypageBadge={showMypageBadge}>{children}</AppShell>;
}
