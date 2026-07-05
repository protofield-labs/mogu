"use client";

import { useEffect, useState } from "react";

import { authFetch } from "@/lib/auth/auth-fetch";

type MeUser = {
  id: string;
  displayName: string;
  avatarColor: string;
  counts: {
    collections: number;
    spots: number;
    friends: number;
  };
};

type MeBadges = {
  pendingFriendRequests: number;
  unreadFlags: number;
};

export function HomeContent() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [badges, setBadges] = useState<MeBadges | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadMe() {
      try {
        const [response, badgesResponse] = await Promise.all([
          authFetch("/api/v1/me"),
          authFetch("/api/v1/me/badges"),
        ]);
        if (response.status === 404) {
          if (!cancelled) {
            setError("User row not found. Try logging in again.");
          }
          return;
        }
        if (!response.ok) {
          throw new Error(`Failed to load profile (${response.status})`);
        }
        if (!badgesResponse.ok) {
          throw new Error(`Failed to load badges (${badgesResponse.status})`);
        }
        const data = (await response.json()) as MeUser;
        const badgesData = (await badgesResponse.json()) as MeBadges;
        if (!cancelled) {
          setUser(data);
          setBadges(badgesData);
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
      <div className="flex justify-center gap-4 text-sm text-gray-600">
        <span>Collections {user.counts.collections}</span>
        <span>Spots {user.counts.spots}</span>
        <span>Friends {user.counts.friends}</span>
      </div>
      {badges && badges.pendingFriendRequests > 0 ? (
        <p className="text-xs font-medium text-red-600">
          Pending friend requests: {badges.pendingFriendRequests}
        </p>
      ) : null}
      <p className="text-sm text-gray-500">UID: {user.id}</p>
      <p className="text-xs text-green-700">
        Auth → DAL → RLS verified via GET /api/v1/me
      </p>
    </div>
  );
}
