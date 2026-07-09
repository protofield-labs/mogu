"use client";

import { useEffect, useRef, useState } from "react";

import { AvatarRow, FeedFilterChip } from "@/components/home/avatar-row";
import { MoguBrandIcon } from "@/components/brand/mogu-brand-icon";
import { MoguWordmark } from "@/components/brand/mogu-wordmark";
import { FeedItemCard } from "@/components/home/feed-item-card";
import { HomeFeedMapView } from "@/components/home/home-feed-map-view";
import { HomeEmptyState } from "@/components/home/home-empty-state";
import { HomeNotificationButton } from "@/components/home/home-notification-button";
import { RecommendationDetailSheet } from "@/components/home/recommendation-detail-sheet";
import { RecommendationCompactRow } from "@/components/home/recommendation-compact-row";
import { RecommendationEmptyRow } from "@/components/home/recommendation-empty-row";
import { HomeViewSkeleton } from "@/components/loading/skeletons";
import {
  CollectionSpotViewTabs,
  type CollectionSpotViewMode,
} from "@/components/collections/collection-spot-view-tabs";
import { Button } from "@/components/ui/button";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { fetchFeedPage, fetchHomeRecommendation } from "@/lib/home/browser-api";
import {
  HOME_RECOMMENDATION_LOAD_ERROR,
  HOME_RECOMMENDATION_LOADING_ARIA,
} from "@/lib/home/recommendation-labels";
import {
  filterFeedByActor,
  getLastReadFeedAt,
  markFeedRead,
  oldestFeedItemTime,
  shouldShowSoloEmptyState,
} from "@/lib/home/feed-read";
import type { FeedItem, FeedPage, Recommendation } from "@/lib/home/types";
import { fetchFriends } from "@/lib/mypage/browser-api";
import { useMe } from "@/lib/mypage/me-provider";
import type { FriendUser } from "@/lib/mypage/types";

type RecommendationState =
  | { status: "loading" }
  | { status: "ready"; value: Recommendation | null }
  | { status: "error" };

/**
 * Extra pages fetched on load so avatar-row unread rings can see items
 * between lastReadFeedAt and the first page boundary (#54 ring accuracy).
 */
const MAX_RING_BACKFILL_PAGES = 3;

async function loadFeedForRings(
  lastReadAt: Date | null,
): Promise<{ items: FeedItem[]; nextCursor: string | null }> {
  let page: FeedPage = await fetchFeedPage();
  const items = [...page.items];

  if (lastReadAt) {
    let backfills = 0;
    while (
      page.nextCursor &&
      backfills < MAX_RING_BACKFILL_PAGES &&
      oldestFeedItemTime(items) > lastReadAt.getTime()
    ) {
      page = await fetchFeedPage(page.nextCursor);
      items.push(...page.items);
      backfills += 1;
    }
  }

  return { items, nextCursor: page.nextCursor };
}

export function HomeView() {
  const { me, loading: meLoading, error: meError, refreshMe } = useMe();
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendationState>({
    status: "loading",
  });
  const [lastReadAt, setLastReadAt] = useState<Date | null>(null);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [feedViewMode, setFeedViewMode] = useState<CollectionSpotViewMode>("list");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [initialFeedCount, setInitialFeedCount] = useState<number | null>(null);
  const [openRecommendation, setOpenRecommendation] =
    useState<Recommendation | null>(null);
  const feedViewedRef = useRef(false);
  const selectedFriendIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedFriendIdRef.current = selectedFriendId;
  }, [selectedFriendId]);

  useEffect(() => {
    if (meLoading) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const storedLastReadAt = getLastReadFeedAt();
        const [friendList, feed, homeRecommendation] = await Promise.all([
          fetchFriends(),
          loadFeedForRings(storedLastReadAt),
          fetchHomeRecommendation()
            .then(
              (value): RecommendationState => ({ status: "ready", value }),
            )
            .catch((): RecommendationState => ({ status: "error" })),
        ]);

        if (cancelled) {
          return;
        }

        setFriends(friendList);
        setFeedItems(feed.items);
        setNextCursor(feed.nextCursor);
        setInitialFeedCount((current) => current ?? feed.items.length);
        setRecommendation(homeRecommendation);
        setLastReadAt(storedLastReadAt);
        feedViewedRef.current = true;
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "読み込みに失敗しました");
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
  }, [meLoading, reloadToken]);

  useEffect(() => {
    return () => {
      if (feedViewedRef.current && !selectedFriendIdRef.current) {
        markFeedRead();
      }
    };
  }, []);

  async function handlePullRefresh() {
    if (refreshing) {
      return;
    }
    setOpenRecommendation(null);
    setRefreshing(true);
    setError(null);
    try {
      const storedLastReadAt = getLastReadFeedAt();
      const [, friendList, feed, homeRecommendation] = await Promise.all([
        refreshMe(),
        fetchFriends(),
        loadFeedForRings(storedLastReadAt),
        fetchHomeRecommendation()
          .then(
            (value): RecommendationState => ({ status: "ready", value }),
          )
          .catch((): RecommendationState => ({ status: "error" })),
      ]);

      setFriends(friendList);
      setFeedItems(feed.items);
      setNextCursor(feed.nextCursor);
      setRecommendation(homeRecommendation);
      setLastReadAt(storedLastReadAt);
      feedViewedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleLoadMore() {
    if (!nextCursor || loadingMore) {
      return;
    }
    setLoadingMore(true);
    setError(null);
    try {
      const page = await fetchFeedPage(nextCursor);
      setFeedItems((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "続きを読み込めませんでした");
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleRetryRecommendation() {
    setOpenRecommendation(null);
    setRecommendation({ status: "loading" });
    try {
      const value = await fetchHomeRecommendation();
      setRecommendation({ status: "ready", value });
    } catch {
      setRecommendation({ status: "error" });
    }
  }

  function handleRetryInitialLoad() {
    setOpenRecommendation(null);
    setLoading(true);
    setError(null);
    setReloadToken((current) => current + 1);
    void refreshMe();
  }

  function handleSelectFriend(friendId: string) {
    setSelectedFriendId((current) => (current === friendId ? null : friendId));
    setFeedViewMode("list");
  }

  function handleClearFeedFilter() {
    setSelectedFriendId(null);
    setFeedViewMode("list");
  }

  function handleFeedViewModeChange(mode: CollectionSpotViewMode) {
    setFeedViewMode(mode);
  }

  /**
   * Keep item.savedByMe (and the savedCount snapshot) in sync with save
   * toggles so list/map switches don't revive stale server state (#283).
   * savedCount counts DISTINCT savers per place (erd-api §5), so the
   * server-refreshed count is applied to every row of that place.
   */
  function handleSpotSavedChange(
    spotId: string,
    saved: boolean,
    savedCount: number | null,
  ) {
    setFeedItems((current) => {
      const toggled = current.find((item) => item.spot.id === spotId);
      if (!toggled) {
        return current;
      }
      const placeId = toggled.spot.placeId;
      return current.map((item) => {
        if (item.spot.placeId !== placeId) {
          return item;
        }
        return {
          ...item,
          savedByMe: item.spot.id === spotId ? saved : item.savedByMe,
          spot:
            savedCount === null || item.spot.savedCount === savedCount
              ? item.spot
              : { ...item.spot, savedCount },
        };
      });
    });
  }

  if (loading || meLoading) {
    return <HomeViewSkeleton embedded />;
  }

  if (!me) {
    return (
      <LoadErrorState
        message={meError ?? error ?? "プロフィールを表示できませんでした"}
        onRetry={handleRetryInitialLoad}
      />
    );
  }

  const solo = shouldShowSoloEmptyState(me.counts.friends);
  const visibleFeedItems = filterFeedByActor(feedItems, selectedFriendId);
  const selectedFriend = selectedFriendId
    ? friends.find((friend) => friend.id === selectedFriendId)
    : null;

  return (
    <PullToRefresh
      onRefresh={handlePullRefresh}
      disabled={loading || refreshing}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-5 py-mogu-screen-y">
      <header className="flex shrink-0 items-center justify-between px-mogu-screen-x">
        <div className="flex items-center gap-2">
          <MoguBrandIcon className="size-5" />
          <MoguWordmark as="h1" />
        </div>
        <HomeNotificationButton />
      </header>

      <AvatarRow
        friends={friends}
        feedItems={feedItems}
        lastReadAt={lastReadAt}
        selectedFriendId={selectedFriendId}
        onSelectFriend={handleSelectFriend}
      />

      {selectedFriend ? (
        <FeedFilterChip
          displayName={selectedFriend.displayName}
          onClear={handleClearFeedFilter}
        />
      ) : null}

      {recommendation.status === "ready" && recommendation.value ? (
        <div className="shrink-0">
          <RecommendationCompactRow
            recommendation={recommendation.value}
            onOpen={setOpenRecommendation}
          />
          <RecommendationDetailSheet
            key={(openRecommendation ?? recommendation.value).spot.id}
            recommendation={openRecommendation ?? recommendation.value}
            open={openRecommendation !== null && recommendation.status === "ready"}
            onClose={() => setOpenRecommendation(null)}
          />
        </div>
      ) : recommendation.status === "error" ? (
        <LoadErrorState
          variant="inline"
          className="mx-mogu-screen-x shrink-0"
          message={HOME_RECOMMENDATION_LOAD_ERROR}
          onRetry={() => void handleRetryRecommendation()}
        />
      ) : recommendation.status === "loading" ? (
        <Skeleton
          aria-busy="true"
          aria-label={HOME_RECOMMENDATION_LOADING_ARIA}
          className="mx-mogu-screen-x h-14 shrink-0 rounded-2xl"
        />
      ) : (
        <RecommendationEmptyRow
          ownSpotCount={me.counts.spots}
          friendCount={friends.length}
        />
      )}

      {solo && feedItems.length === 0 ? (
        <HomeEmptyState />
      ) : (
        <section className="space-y-3">
          <div className="space-y-3 border-t border-dashed border-border px-mogu-screen-x pt-4">
            <h2 className="text-sm font-semibold text-foreground">新着フィード</h2>
            {visibleFeedItems.length > 0 ? (
              <CollectionSpotViewTabs
                mode={feedViewMode}
                onChange={handleFeedViewModeChange}
              />
            ) : null}
          </div>

          {visibleFeedItems.length === 0 ? (
            <p className="px-mogu-screen-x text-sm text-muted-foreground">
              {selectedFriend
                ? nextCursor
                  ? `${selectedFriend.displayName}さんの投稿は、まだ読み込まれていない可能性があります。「もっと見る」で続きを確認できます。`
                  : `まだ${selectedFriend.displayName}さんの記録がありません。`
                : "まだ友達の記録がありません。"}
            </p>
          ) : feedViewMode === "map" ? (
            <div className="px-mogu-screen-x">
              <HomeFeedMapView
                key={selectedFriendId ?? "all"}
                items={visibleFeedItems}
                viewerId={me.id}
                onSavedChange={handleSpotSavedChange}
              />
            </div>
          ) : (
            <div>
              {visibleFeedItems.map((item, index) => (
                <FeedItemCard
                  key={`${item.spot.id}:${item.likedByMe}:${item.likeCount}`}
                  item={item}
                  viewerId={me.id}
                  enterIndex={
                    initialFeedCount !== null && index < initialFeedCount
                      ? index
                      : undefined
                  }
                  onSavedChange={(saved, savedCount) =>
                    handleSpotSavedChange(item.spot.id, saved, savedCount)
                  }
                />
              ))}
            </div>
          )}

          {feedViewMode === "list" && nextCursor ? (
            <div className="flex justify-center px-mogu-screen-x pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loadingMore}
                onClick={() => void handleLoadMore()}
              >
                {loadingMore ? (
                  <>
                    <Spinner size="sm" />
                    読み込み中…
                  </>
                ) : (
                  "もっと見る"
                )}
              </Button>
            </div>
          ) : null}
        </section>
      )}

      {error ? (
        <LoadErrorState
          variant="inline"
          className="mx-mogu-screen-x"
          message={error}
          onRetry={() => void handleLoadMore()}
          retrying={loadingMore}
        />
      ) : null}
      </div>
    </PullToRefresh>
  );
}
