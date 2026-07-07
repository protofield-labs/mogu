"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { GoogleMapsAttribution } from "@/components/places/google-maps-attribution";
import { SpotDetailMedia } from "@/components/spots/spot-detail-media";
import { CollectionDetailSkeleton } from "@/components/loading/skeletons";
import { RecollectPicker } from "@/components/recollect/recollect-picker";
import { FriendAccessGate } from "@/components/share/friend-access-gate";
import { ShareButton } from "@/components/share/share-button";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { Button } from "@/components/ui/button";
import { googleMapsPlaceUrl, openNowLabel } from "@/lib/agent/chat-helpers";
import { formatRatingChip, formatSpotTagChips } from "@/lib/home/feed-labels";
import { usePlace } from "@/lib/places/use-place";
import { useRecollect } from "@/lib/recollect/use-recollect";
import { collectionPath } from "@/lib/share/paths";
import { loadSpotPage, type SpotDetail } from "@/lib/share/browser-api";
import { spotShareUrl } from "@/lib/share/share-url";
import { fetchMe } from "@/lib/mypage/browser-api";

type SpotDetailPageViewProps = {
  spotId: string;
};

export function SpotDetailPageView({ spotId }: SpotDetailPageViewProps) {
  const [spot, setSpot] = useState<SpotDetail | null>(null);
  const [gate, setGate] = useState<Awaited<
    ReturnType<typeof loadSpotPage>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [prevSpotId, setPrevSpotId] = useState(spotId);

  const recollect = useRecollect(spotId);
  const { place, placeName } = usePlace(spot?.placeId ?? "", Boolean(spot));

  if (spotId !== prevSpotId) {
    setPrevSpotId(spotId);
    setLoading(true);
    setLoadError(null);
    setSpot(null);
    setGate(null);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [result, me] = await Promise.all([loadSpotPage(spotId), fetchMe()]);
        if (cancelled) {
          return;
        }
        setViewerId(me.id);
        if (result.kind === "detail") {
          setSpot(result.spot);
          setGate(null);
          return;
        }
        setSpot(null);
        setGate(result);
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
  }, [spotId, reloadToken]);

  function handleRetryLoad() {
    setLoading(true);
    setLoadError(null);
    setReloadToken((current) => current + 1);
  }

  if (loading) {
    return <CollectionDetailSkeleton />;
  }

  if (gate?.kind === "gate") {
    return (
      <FriendAccessGate
        ownerDisplayName={gate.gate.ownerDisplayName}
        ownerId={gate.gate.ownerId}
        resourceLabel={`「${gate.gate.collectionName}」のスポット`}
      />
    );
  }

  if (!spot) {
    return (
      <LoadErrorState
        message={loadError ?? "スポットを表示できませんでした"}
        onRetry={handleRetryLoad}
      />
    );
  }

  const tagChips = formatSpotTagChips(spot);
  const title = placeName ?? (spot.comment || spot.collectionName);
  const showComment = Boolean(spot.comment && placeName);
  const openNowLabelText = openNowLabel(place?.openNow);
  const isOwner = viewerId === spot.addedBy;
  const backHref = collectionPath(spot.collectionId);

  return (
    <div className="flex flex-1 flex-col gap-6 pb-mogu-screen-y">
      <header className="flex items-center gap-3 px-mogu-screen-x pt-3">
        <Link
          href={backHref}
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-mogu-surface-elevated"
          aria-label="コレクションに戻る"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground">{spot.collectionName}</p>
          <h1 className="truncate text-base font-semibold text-foreground">{title}</h1>
        </div>
        <ShareButton url={spotShareUrl(spot.id)} />
      </header>

      <section className="space-y-4 px-mogu-screen-x">
        <SpotDetailMedia
          photoUrls={spot.photoUrls}
          place={place}
          placeName={placeName}
        />

        {place?.address ? (
          <p className="text-sm text-muted-foreground">{place.address}</p>
        ) : null}

        {openNowLabelText ? (
          <p className="text-xs font-medium text-primary">{openNowLabelText}</p>
        ) : null}

        {showComment ? (
          <p className="text-sm text-foreground">{spot.comment}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground">
            {formatRatingChip(spot.rating)}
          </span>
          {tagChips.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={googleMapsPlaceUrl({
              placeId: spot.placeId,
              name: placeName,
              location: place?.location,
            })}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center justify-center rounded-[min(var(--radius-md),12px)] border border-border bg-background px-3 text-sm font-medium hover:bg-muted hover:text-foreground"
          >
            地図で開く
          </a>
          {!isOwner ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={recollect.busy}
              aria-pressed={recollect.saved}
              {...recollect.saveHandlers}
            >
              {recollect.saved ? "保存済み" : "保存"}
            </Button>
          ) : null}
        </div>

        {recollect.error ? (
          <p className="text-sm text-destructive" role="alert">
            {recollect.error}
          </p>
        ) : null}

        <GoogleMapsAttribution className="text-[0.65rem] text-muted-foreground" />
      </section>

      <RecollectPicker spotId={spot.id} recollect={recollect} />
    </div>
  );
}
