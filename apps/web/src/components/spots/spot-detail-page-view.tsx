"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { GoogleMapsAttribution } from "@/components/places/google-maps-attribution";
import { SpotDetailMedia } from "@/components/spots/spot-detail-media";
import { CollectionDetailSkeleton } from "@/components/loading/skeletons";
import { SpotSaveFooter } from "@/components/recollect/spot-save-footer";
import { FriendAccessGate } from "@/components/share/friend-access-gate";
import { ShareButton } from "@/components/share/share-button";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { openNowLabel } from "@/lib/places/maps-links";
import { formatRatingChip, formatSpotTagChips } from "@/lib/home/feed-labels";
import { usePlace } from "@/lib/places/use-place";
import { useRecollect } from "@/lib/recollect/use-recollect";
import { collectionPath } from "@/lib/share/paths";
import { loadSpotPage, type SpotDetail } from "@/lib/share/browser-api";
import { spotShareUrl } from "@/lib/share/share-url";
import { useMe } from "@/lib/mypage/me-provider";

type SpotDetailPageViewProps = {
  spotId: string;
};

export function SpotDetailPageView({ spotId }: SpotDetailPageViewProps) {
  const { me, loading: meLoading, error: meError, refreshMe } = useMe();
  const [spot, setSpot] = useState<SpotDetail | null>(null);
  const [gate, setGate] = useState<Awaited<
    ReturnType<typeof loadSpotPage>
  > | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
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
    if (meLoading) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const result = await loadSpotPage(spotId);
        if (cancelled) {
          return;
        }
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
  }, [meLoading, spotId, reloadToken]);

  function handleRetryLoad() {
    setLoading(true);
    setLoadError(null);
    setReloadToken((current) => current + 1);
    void refreshMe();
  }

  if (loading || meLoading) {
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

  if (!me) {
    return (
      <LoadErrorState
        message={meError ?? "プロフィールを表示できませんでした"}
        onRetry={handleRetryLoad}
      />
    );
  }

  const tagChips = formatSpotTagChips(spot);
  const title = placeName ?? (spot.comment || spot.collectionName);
  const showComment = Boolean(spot.comment && placeName);
  const openNowLabelText = openNowLabel(place?.openNow);
  const isOwner = me.id === spot.addedBy;
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

        <SpotSaveFooter spotId={spot.id} recollect={recollect}>
          <div className="flex flex-wrap gap-2">
            <SpotSaveFooter.MapLink
              placeId={spot.placeId}
              placeName={placeName}
              place={place}
            />
            {!isOwner ? (
              <SpotSaveFooter.SaveButton
                label="保存"
                variant="secondary"
                size="sm"
              />
            ) : null}
          </div>

          <SpotSaveFooter.Error className="text-sm" />
          <SpotSaveFooter.Picker />
        </SpotSaveFooter>

        <GoogleMapsAttribution className="text-[0.65rem] text-muted-foreground" />
      </section>
    </div>
  );
}
