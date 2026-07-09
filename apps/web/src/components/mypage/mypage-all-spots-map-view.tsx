"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CollectionSpotMapView } from "@/components/collections/collection-spot-map-view";
import { MypageViewSkeleton } from "@/components/loading/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { loadAllMySpots } from "@/lib/mypage/load-all-my-spots";
import { stashPendingCollectionConsult } from "@/lib/mypage/pending-collection-consult";
import { useUserLocation } from "@/lib/places/use-user-location";
import { spotPath } from "@/lib/share/paths";
import { touchRowClass } from "@/lib/ui/touch-feedback";
import type { Spot } from "@/lib/spots/browser-api";
import { cn } from "@/lib/utils";

export function MypageAllSpotsMapView() {
  const router = useRouter();
  const [spots, setSpots] = useState<Spot[]>([]);
  const [mapSpots, setMapSpots] = useState<Spot[]>([]);
  const [collectionNameBySpotId, setCollectionNameBySpotId] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [mapsLoadFailed, setMapsLoadFailed] = useState(false);
  const userLocation = useUserLocation();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const result = await loadAllMySpots();
        if (cancelled) {
          return;
        }
        setSpots(result.spots);
        setMapSpots(result.mapSpots);
        setCollectionNameBySpotId(result.collectionNameBySpotId);
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
  }, [reloadToken]);

  function handleConsultAgentForFirstSpot() {
    stashPendingCollectionConsult({ kind: "first-spot" });
    router.push("/search");
  }

  if (loading) {
    return <MypageViewSkeleton />;
  }

  if (loadError) {
    return (
      <LoadErrorState
        message={loadError}
        onRetry={() => setReloadToken((token) => token + 1)}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 pb-mogu-screen-y">
      <header className="flex items-center gap-3 px-mogu-screen-x pt-3">
        <Link
          href="/mypage"
          className={cn(
            "flex size-11 items-center justify-center rounded-full border border-border bg-mogu-surface-elevated",
            touchRowClass,
          )}
          aria-label="マイページに戻る"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold text-foreground">食マップ</h1>
          <p className="text-xs text-muted-foreground">
            {spots.length} 件のスポット
            {!mapsLoadFailed && mapSpots.length > 0
              ? ` · 地図 ${mapSpots.length} ピン`
              : ""}
          </p>
        </div>
      </header>

      <section className="flex min-h-0 flex-1 flex-col px-mogu-screen-x">
        {spots.length === 0 ? (
          <EmptyState className="space-y-4 p-6">
            <p>まだスポットがありません。</p>
            <Button type="button" onClick={handleConsultAgentForFirstSpot}>
              エージェントに相談して最初のスポットを追加
            </Button>
          </EmptyState>
        ) : (
          <CollectionSpotMapView
            spots={mapSpots}
            spotLabels={collectionNameBySpotId}
            userLocation={userLocation}
            selectedSpotId={selectedSpotId}
            onSelectSpot={(spot) => setSelectedSpotId(spot.id)}
            onClearSelection={() => setSelectedSpotId(null)}
            detailHrefForSpot={(spot) => spotPath(spot.id)}
            mapClassName="h-[min(70dvh,640px)] w-full"
            onMapsLoadErrorChange={setMapsLoadFailed}
          />
        )}
      </section>
    </div>
  );
}
