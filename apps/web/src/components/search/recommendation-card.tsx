"use client";

import { useEffect, useState } from "react";
import { ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fetchPlace, recollectSpot } from "@/lib/agent/browser-api";
import {
  googleMapsPlaceUrl,
  openNowLabel,
} from "@/lib/agent/chat-helpers";
import type { Recommendation, Spot } from "@/lib/agent/types";
import { listMyCollections } from "@/lib/collections/browser-api";

type RecommendationCardProps = {
  recommendation: Recommendation;
};

function SpotSummary({ spot, compact = false }: { spot: Spot; compact?: boolean }) {
  const [placeName, setPlaceName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchPlace(spot.placeId).then((place) => {
      if (!cancelled && place) {
        setPlaceName(place.name);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [spot.placeId]);

  return (
    <div className={compact ? "text-sm text-muted-foreground" : undefined}>
      <p className="font-medium text-foreground">
        {placeName ?? (spot.comment || "スポット")}
      </p>
      {!compact && spot.comment ? (
        <p className="mt-1 text-sm text-muted-foreground">{spot.comment}</p>
      ) : null}
      {spot.savedCount > 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          輪で{spot.savedCount}人が保存
        </p>
      ) : null}
    </div>
  );
}

type CollectionsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; targetCollectionId: string | null };

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const { spot, assertion, evidence, alternatives } = recommendation;
  const [openNow, setOpenNow] = useState<boolean | undefined>();
  const [collections, setCollections] = useState<CollectionsState>({
    status: "loading",
  });
  const [recollecting, setRecollecting] = useState(false);
  const [recollected, setRecollected] = useState(false);
  const [recollectError, setRecollectError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchPlace(spot.placeId).then((place) => {
      if (!cancelled && place) {
        setOpenNow(place.openNow);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [spot.placeId]);

  useEffect(() => {
    let cancelled = false;
    void listMyCollections()
      .then((result) => {
        if (!cancelled) {
          setCollections({
            status: "ready",
            targetCollectionId: result[0]?.id ?? null,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCollections({ status: "error" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openNowText = openNowLabel(openNow);
  const hasNoCollection =
    collections.status === "ready" && collections.targetCollectionId === null;

  async function resolveTargetCollectionId(): Promise<string | null> {
    if (collections.status === "ready") {
      return collections.targetCollectionId;
    }
    // Initial load failed or is in flight: retry here so a transient error
    // does not permanently disable the save button.
    try {
      const result = await listMyCollections();
      const targetCollectionId = result[0]?.id ?? null;
      setCollections({ status: "ready", targetCollectionId });
      return targetCollectionId;
    } catch {
      setCollections({ status: "error" });
      return null;
    }
  }

  async function handleRecollect() {
    setRecollecting(true);
    setRecollectError(null);
    try {
      const targetCollectionId = await resolveTargetCollectionId();
      if (!targetCollectionId) {
        setRecollectError(
          collections.status === "error"
            ? "コレクションを読み込めませんでした。もう一度お試しください"
            : "保存先のコレクションがありません",
        );
        return;
      }

      const ok = await recollectSpot(spot.id, targetCollectionId);
      if (ok) {
        setRecollected(true);
      } else {
        setRecollectError("リコレクションに失敗しました");
      }
    } finally {
      setRecollecting(false);
    }
  }

  return (
    <div className="mt-2 w-full max-w-full rounded-xl border border-border bg-mogu-surface-elevated p-mogu-screen-x py-3">
      {spot.photoUrls[0] ? (
        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded spot photos
        <img
          src={spot.photoUrls[0]}
          alt=""
          className="mb-3 aspect-[16/10] w-full rounded-lg object-cover"
        />
      ) : null}

      <p className="text-sm font-semibold leading-snug text-foreground">
        {assertion}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{evidence}</p>

      <div className="mt-3">
        <SpotSummary spot={spot} />
      </div>

      {openNowText ? (
        <p className="mt-2 text-xs font-medium text-primary">{openNowText}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={googleMapsPlaceUrl(spot.placeId)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-7 items-center justify-center rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted hover:text-foreground"
        >
          地図で開く
        </a>
        <Button
          variant="secondary"
          size="sm"
          disabled={recollecting || recollected || hasNoCollection}
          onClick={() => void handleRecollect()}
        >
          {recollected ? "保存済み" : "リコレクション"}
        </Button>
      </div>

      {recollectError ? (
        <p className="mt-2 text-xs text-destructive">{recollectError}</p>
      ) : null}
      {hasNoCollection && !recollected ? (
        <p className="mt-2 text-xs text-muted-foreground">
          マイページでコレクションを作成すると保存できます
        </p>
      ) : null}

      <p className="mt-2 text-[0.65rem] text-muted-foreground">Google Maps</p>

      {alternatives.length > 0 ? (
        <details className="group mt-3 border-t border-border pt-3">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" />
            副候補（{alternatives.length}件）
          </summary>
          <ul className="mt-2 flex flex-col gap-3">
            {alternatives.map((alt) => (
              <li
                key={alt.id}
                className="rounded-lg border border-border bg-background p-3"
              >
                <SpotSummary spot={alt} compact />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
