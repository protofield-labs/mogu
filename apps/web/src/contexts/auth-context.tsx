"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  use,
  type ReactNode,
} from "react";
import {
  onIdTokenChanged,
  signOut,
  type User,
} from "firebase/auth";

import { getFirebaseAuth } from "@/lib/auth/firebase-client";
import { clearAgentChatSession } from "@/lib/agent/session-storage";
import { clearLastReadFeedAt } from "@/lib/home/feed-read";
import { clearPendingRecommendation } from "@/lib/home/pending-recommendation";
import { clearPendingCollectionConsult } from "@/lib/mypage/pending-collection-consult";

function isFirebaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
        process.env.NEXT_PUBLIC_GCP_PROJECT_ID) &&
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  );
}

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  getIdToken: () => Promise<string | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const firebaseConfigured = isFirebaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);

  useEffect(() => {
    if (!firebaseConfigured) {
      return;
    }

    const auth = getFirebaseAuth();
    return onIdTokenChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, [firebaseConfigured]);

  const getIdToken = useCallback(async () => {
    const current = getFirebaseAuth().currentUser;
    if (!current) {
      return null;
    }
    return current.getIdToken();
  }, []);

  const logout = useCallback(async () => {
    // Per-user client state must not leak to the next account on a
    // shared device (stashed recommendation, feed read marker).
    clearPendingRecommendation();
    clearPendingCollectionConsult();
    clearLastReadFeedAt();
    clearAgentChatSession();
    await signOut(getFirebaseAuth());
    router.replace("/login");
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, getIdToken, logout }),
    [user, loading, getIdToken, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
