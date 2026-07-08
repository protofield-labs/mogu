"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { BADGES_UPDATED_EVENT, PROFILE_UPDATED_EVENT } from "@/lib/mypage/badge-events";
import { fetchMe, fetchMeBadges } from "@/lib/mypage/browser-api";
import { shouldShowMypageTabBadge } from "@/lib/mypage/stats-row";
import type { MeBadges, MeProfile } from "@/lib/mypage/types";

type MeBadgesContextValue = {
  badges: MeBadges | null;
  showBadge: boolean;
  tabProfile: Pick<MeProfile, "displayName" | "avatarColor"> | null;
};

const MeBadgesContext = createContext<MeBadgesContextValue | null>(null);

export function MeBadgesProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [badges, setBadges] = useState<MeBadges | null>(null);
  const [tabProfile, setTabProfile] = useState<
    Pick<MeProfile, "displayName" | "avatarColor"> | null
  >(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [badgesResult, meResult] = await Promise.allSettled([
        fetchMeBadges(),
        fetchMe(),
      ]);

      if (cancelled) {
        return;
      }

      if (badgesResult.status === "fulfilled") {
        setBadges(badgesResult.value);
      } else {
        setBadges(null);
      }

      if (meResult.status === "fulfilled") {
        setTabProfile({
          displayName: meResult.value.displayName,
          avatarColor: meResult.value.avatarColor,
        });
      } else {
        setTabProfile(null);
      }
    }

    void load();

    const handleRefresh = () => {
      void load();
    };
    window.addEventListener(BADGES_UPDATED_EVENT, handleRefresh);
    window.addEventListener(PROFILE_UPDATED_EVENT, handleRefresh);

    return () => {
      cancelled = true;
      window.removeEventListener(BADGES_UPDATED_EVENT, handleRefresh);
      window.removeEventListener(PROFILE_UPDATED_EVENT, handleRefresh);
    };
  }, [pathname]);

  const value: MeBadgesContextValue = {
    badges,
    showBadge: badges ? shouldShowMypageTabBadge(badges) : false,
    tabProfile,
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
