"use client";

import { useEffect, useState } from "react";

import { CollectionDetailSkeleton } from "@/components/loading/skeletons";
import { CollectionDetailView } from "@/components/mypage/collection-detail-view";
import { FriendAccessGate } from "@/components/share/friend-access-gate";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { FriendCollectionDetailView } from "@/components/users/friend-collection-detail-view";
import { useMe } from "@/lib/mypage/me-provider";
import { loadCollectionPage } from "@/lib/share/browser-api";

type CollectionPageViewProps = {
  collectionId: string;
  initialSpotId?: string | null;
};

type ViewMode = "owner" | "friend" | "gate" | "missing";

export function CollectionPageView({
  collectionId,
  initialSpotId = null,
}: CollectionPageViewProps) {
  const { me, loading: meLoading } = useMe();
  const [viewMode, setViewMode] = useState<ViewMode | null>(null);
  const [friendOwnerId, setFriendOwnerId] = useState<string | null>(null);
  const [gateInfo, setGateInfo] = useState<{
    ownerDisplayName: string;
    ownerId: string;
    collectionName: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [prevCollectionId, setPrevCollectionId] = useState(collectionId);

  if (collectionId !== prevCollectionId) {
    setPrevCollectionId(collectionId);
    setLoading(true);
    setLoadError(null);
    setViewMode(null);
    setFriendOwnerId(null);
    setGateInfo(null);
  }

  useEffect(() => {
    if (meLoading) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const result = await loadCollectionPage(collectionId);
        if (cancelled) {
          return;
        }
        if (result.kind === "gate") {
          setViewMode("gate");
          setGateInfo(result.gate);
          setFriendOwnerId(null);
          return;
        }
        if (!me) {
          setLoadError("プロフィールを表示できませんでした");
          return;
        }
        if (result.kind === "detail") {
          if (result.detail.ownerId === me.id) {
            setViewMode("owner");
            setFriendOwnerId(null);
            setGateInfo(null);
          } else {
            setViewMode("friend");
            setFriendOwnerId(result.detail.ownerId);
            setGateInfo(null);
          }
          return;
        }
        setViewMode("missing");
        setGateInfo(null);
        setFriendOwnerId(null);
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
  }, [collectionId, me, meLoading, reloadToken]);

  function handleRetryLoad() {
    setLoading(true);
    setLoadError(null);
    setReloadToken((current) => current + 1);
  }

  if (loading || meLoading) {
    return <CollectionDetailSkeleton />;
  }

  if (viewMode === "gate" && gateInfo) {
    return (
      <FriendAccessGate
        ownerDisplayName={gateInfo.ownerDisplayName}
        ownerId={gateInfo.ownerId}
        resourceLabel={`「${gateInfo.collectionName}」`}
      />
    );
  }

  if (viewMode === "owner") {
    return (
      <CollectionDetailView
        collectionId={collectionId}
        initialSpotId={initialSpotId}
      />
    );
  }

  if (viewMode === "friend" && friendOwnerId) {
    return (
      <FriendCollectionDetailView
        ownerId={friendOwnerId}
        collectionId={collectionId}
      />
    );
  }

  return (
    <LoadErrorState
      message={loadError ?? "コレクションを表示できませんでした"}
      onRetry={handleRetryLoad}
    />
  );
}
