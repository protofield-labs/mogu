"use client";

import { useEffect, useState } from "react";

import { authFetch } from "@/lib/auth/auth-fetch";

type MeUser = {
  firebaseUid: string;
  displayName: string;
  avatarColor: string;
  createdAt: string;
};

export function HomeContent() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadMe() {
      try {
        const response = await authFetch("/api/v1/users/me");
        if (response.status === 404) {
          if (!cancelled) {
            setError("User row not found. Try logging in again.");
          }
          return;
        }
        if (!response.ok) {
          throw new Error(`Failed to load profile (${response.status})`);
        }
        const data = (await response.json()) as { user: MeUser };
        if (!cancelled) {
          setUser(data.user);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load profile");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadMe();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-gray-600">Loading profile…</p>;
  }

  if (error) {
    return <p className="text-red-600">{error}</p>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-2 text-center">
      <p className="text-lg text-gray-800">
        Welcome, <span className="font-semibold">{user.displayName}</span>
      </p>
      <p className="text-sm text-gray-500">UID: {user.firebaseUid}</p>
      <p className="text-xs text-green-700">
        Auth → DAL → RLS verified via GET /api/v1/users/me
      </p>
    </div>
  );
}
