"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { BADGES_UPDATED_EVENT } from "@/lib/mypage/badge-events";
import { fetchMeBadges } from "@/lib/mypage/browser-api";
import { shouldShowMypageTabBadge } from "@/lib/mypage/stats-row";
import type { MeBadges } from "@/lib/mypage/types";

export function useMeBadges() {
  const pathname = usePathname();
  const [badges, setBadges] = useState<MeBadges | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBadges() {
      try {
        const next = await fetchMeBadges();
        if (!cancelled) {
          setBadges(next);
        }
      } catch {
        if (!cancelled) {
          setBadges(null);
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

  return {
    badges,
    showBadge: badges ? shouldShowMypageTabBadge(badges) : false,
  };
}
