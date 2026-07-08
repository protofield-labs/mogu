"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/contexts/auth-context";
import { BADGES_UPDATED_EVENT, PROFILE_UPDATED_EVENT } from "@/lib/mypage/badge-events";
import { fetchMe } from "@/lib/mypage/browser-api";
import type { MeProfile } from "@/lib/mypage/types";

type MeUpdate =
  | Partial<MeProfile>
  | ((current: MeProfile | null) => MeProfile | null);

type MeContextValue = {
  me: MeProfile | null;
  loading: boolean;
  error: string | null;
  refreshMe: () => Promise<void>;
  updateMe: (patch: MeUpdate) => void;
};

const MeContext = createContext<MeContextValue | null>(null);

/** Session profile cache (#202). Fetched once; refreshed on profile edit events only. */
export function MeProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [me, setMe] = useState<MeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshMe = useCallback(async () => {
    if (!user) {
      return;
    }
    try {
      const nextMe = await fetchMe();
      setMe(nextMe);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "プロフィールを読み込めませんでした");
    }
  }, [user]);

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const nextMe = await fetchMe();
        if (!cancelled) {
          setMe(nextMe);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "プロフィールを読み込めませんでした",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    const handleRefresh = () => {
      void refreshMe();
    };
    window.addEventListener(PROFILE_UPDATED_EVENT, handleRefresh);
    window.addEventListener(BADGES_UPDATED_EVENT, handleRefresh);

    return () => {
      cancelled = true;
      window.removeEventListener(PROFILE_UPDATED_EVENT, handleRefresh);
      window.removeEventListener(BADGES_UPDATED_EVENT, handleRefresh);
    };
  }, [authLoading, user, refreshMe]);

  const updateMe = useCallback((patch: MeUpdate) => {
    setMe((current) => {
      if (typeof patch === "function") {
        return patch(current);
      }
      return current ? { ...current, ...patch } : current;
    });
  }, []);

  const value: MeContextValue = {
    me,
    loading,
    error,
    refreshMe,
    updateMe,
  };

  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}

export function useMe(): MeContextValue {
  const context = useContext(MeContext);
  if (!context) {
    throw new Error("useMe must be used within MeProvider");
  }
  return context;
}
