"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { BADGES_UPDATED_EVENT } from "@/lib/mypage/badge-events";
import { fetchMeBadges } from "@/lib/mypage/browser-api";
import { shouldShowMypageTabBadge } from "@/lib/mypage/stats-row";
import type { MeBadges } from "@/lib/mypage/types";

type MeBadgesContextValue = {
  badges: MeBadges | null;
  showBadge: boolean;
};

const MeBadgesContext = createContext<MeBadgesContextValue | null>(null);

export function MeBadgesProvider({ children }: { children: ReactNode }) {
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

  const value: MeBadgesContextValue = {
    badges,
    showBadge: badges ? shouldShowMypageTabBadge(badges) : false,
  };

  return (
    <MeBadgesContext.Provider value={value}>{children}</MeBadgesContext.Provider>
  );
}

export function useMeBadges(): MeBadgesContextValue {
  const context = useContext(MeBadgesContext);
  if (!context) {
    throw new Error("useMeBadges must be used within MeBadgesProvider");
  }
  return context;
}
