"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { MypageViewSkeleton } from "@/components/loading/skeletons";
import { CollectionGrid } from "@/components/mypage/collection-grid";
import { FriendProfileHeroCard } from "@/components/users/friend-profile-hero-card";
import { FriendAccessGate } from "@/components/share/friend-access-gate";
import { ShareButton } from "@/components/share/share-button";
import { LoadErrorState } from "@/components/ui/load-error-state";
import {
  fetchFriendProfile,
  listFriendCollections,
} from "@/lib/friends/browser-api";
import { FRIENDS_FROM_HOME, collectionPath, friendsPagePath } from "@/lib/friends/paths";
import { fetchUserShareGate } from "@/lib/share/browser-api";
import { profileShareUrl } from "@/lib/share/share-url";

type FriendProfileViewProps = {
  userId: string;
  fromHome?: boolean;
};

export function FriendProfileView({
  userId,
  fromHome = false,
}: FriendProfileViewProps) {
  const [profile, setProfile] = useState<Awaited<
    ReturnType<typeof fetchFriendProfile>
  > | null>(null);
  const [gate, setGate] = useState<Awaited<
    ReturnType<typeof fetchUserShareGate>
  > | null>(null);
  const [collections, setCollections] = useState<Awaited<
    ReturnType<typeof listFriendCollections>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [prevUserId, setPrevUserId] = useState(userId);

  if (userId !== prevUserId) {
    setPrevUserId(userId);
    setLoading(true);
    setLoadError(null);
    setProfile(null);
    setCollections(null);
    setGate(null);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const nextProfile = await fetchFriendProfile(userId);
        if (cancelled) {
          return;
        }
        if (!nextProfile) {
          const nextGate = await fetchUserShareGate(userId);
          if (!cancelled) {
            setProfile(null);
            setCollections(null);
            setGate(nextGate);
          }
          return;
        }

        const nextCollections = await listFriendCollections(userId);
        if (!cancelled) {
          setProfile(nextProfile);
          setCollections(nextCollections);
          setGate(null);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "読み込みに失敗しました",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [userId, reloadToken]);

  function handleRetryLoad() {
    setLoading(true);
    setLoadError(null);
    setReloadToken((current) => current + 1);
  }

  if (loading) {
    return <MypageViewSkeleton />;
  }

  if (!profile) {
    if (gate) {
      return (
        <FriendAccessGate
          ownerDisplayName={gate.ownerDisplayName}
          ownerId={gate.ownerId}
          resourceLabel="プロフィール"
        />
      );
    }
    return (
      <LoadErrorState
        message={loadError ?? "友達のプロフィールを表示できませんでした"}
        onRetry={handleRetryLoad}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 pb-mogu-screen-y">
      <header className="flex items-center gap-3 px-mogu-screen-x pt-3">
        <Link
          href={friendsPagePath(fromHome ? { from: FRIENDS_FROM_HOME } : undefined)}
          className="flex size-9 items-center justify-center rounded-full border border-border bg-mogu-surface-elevated"
          aria-label="友達一覧に戻る"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
          {profile.displayName}
        </h1>
        <ShareButton url={profileShareUrl(userId)} />
      </header>

      <FriendProfileHeroCard profile={profile} />

      <section className="space-y-2">
        <h2 className="px-mogu-screen-x text-sm font-semibold text-foreground">
          コレクション
        </h2>
        <CollectionGrid
          collections={collections ?? []}
          getCollectionHref={(collection) => collectionPath(collection.id)}
          emptyMessage="まだコレクションがありません。"
        />
      </section>
    </div>
  );
}
