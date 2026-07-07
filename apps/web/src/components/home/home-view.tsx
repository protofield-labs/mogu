"use client";

import { useEffect, useRef, useState } from "react";

import { AvatarRow } from "@/components/home/avatar-row";
import { FeedCompactRow } from "@/components/home/feed-compact-row";
import { FeedHeroCard } from "@/components/home/feed-hero-card";
import { HomeEmptyState } from "@/components/home/home-empty-state";
import { HomeNotificationButton } from "@/components/home/home-notification-button";
import { RecommendationCompactRow } from "@/components/home/recommendation-compact-row";
import { RecommendationEmptyRow } from "@/components/home/recommendation-empty-row";
import { HomeViewSkeleton } from "@/components/loading/skeletons";
import { Button } from "@/components/ui/button";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchFeedPage, fetchHomeRecommendation } from "@/lib/home/browser-api";
import {
  getLastReadFeedAt,
  markFeedRead,
  oldestFeedItemTime,
  shouldShowSoloEmptyState,
} from "@/lib/home/feed-read";
import type { FeedItem, FeedPage, Recommendation } from "@/lib/home/types";
import { fetchFriends, fetchMe } from "@/lib/mypage/browser-api";
import type { FriendUser, MeProfile } from "@/lib/mypage/types";

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
  const [me, setMe] = useState<MeProfile | null>(null);
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendationState>({
    status: "loading",
  });
  const [lastReadAt, setLastReadAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const feedViewedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const storedLastReadAt = getLastReadFeedAt();
        const [profile, friendList, feed, homeRecommendation] =
          await Promise.all([
            fetchMe(),
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

        setMe(profile);
        setFriends(friendList);
        setFeedItems(feed.items);
        setNextCursor(feed.nextCursor);
        setRecommendation(homeRecommendation);
        setLastReadAt(storedLastReadAt);
        // Only a successfully rendered feed counts as "seen" (#54 既読管理).
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
  }, [reloadToken]);

  useEffect(() => {
    return () => {
      if (feedViewedRef.current) {
        markFeedRead();
      }
    };
  }, []);

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
    setRecommendation({ status: "loading" });
    try {
      const value = await fetchHomeRecommendation();
      setRecommendation({ status: "ready", value });
    } catch {
      setRecommendation({ status: "error" });
    }
  }

  function handleRetryInitialLoad() {
    setLoading(true);
    setError(null);
    setReloadToken((current) => current + 1);
  }

  if (loading) {
    return <HomeViewSkeleton embedded />;
  }

  if (error && !me) {
    return (
      <LoadErrorState message={error} onRetry={handleRetryInitialLoad} />
    );
  }

  if (!me) {
    return null;
  }

  const solo = shouldShowSoloEmptyState(me.counts.friends);
  const [heroItem, ...compactItems] = feedItems;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 py-mogu-screen-y">
      <header className="flex items-center justify-between px-mogu-screen-x">
        <h1 className="text-base font-semibold text-foreground">mogu</h1>
        <HomeNotificationButton />
      </header>

      <AvatarRow
        friends={friends}
        feedItems={feedItems}
        lastReadAt={lastReadAt}
      />

      {recommendation.status === "ready" && recommendation.value ? (
        <RecommendationCompactRow recommendation={recommendation.value} />
      ) : recommendation.status === "error" ? (
        <LoadErrorState
          variant="inline"
          className="mx-mogu-screen-x"
          message="一推しを読み込めませんでした"
          onRetry={() => void handleRetryRecommendation()}
        />
      ) : recommendation.status === "loading" ? (
        <Skeleton
          aria-busy="true"
          aria-label="一推しを読み込んでいます"
          className="mx-mogu-screen-x h-14 rounded-2xl"
        />
      ) : (
        <RecommendationEmptyRow ownSpotCount={me.counts.spots} />
      )}

      {solo && feedItems.length === 0 ? (
        <HomeEmptyState />
      ) : (
        <section className="space-y-3 px-mogu-screen-x">
          <div className="border-t border-dashed border-border pt-4">
            <h2 className="text-sm font-semibold text-foreground">新着フィード</h2>
          </div>

          {feedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              まだ友達の記録がありません。
            </p>
          ) : null}

          {heroItem ? <FeedHeroCard item={heroItem} viewerId={me?.id} /> : null}

          {compactItems.length > 0 ? (
            <div className="space-y-2">
              {compactItems.map((item) => (
                <FeedCompactRow key={item.spot.id} item={item} viewerId={me?.id} />
              ))}
            </div>
          ) : null}

          {nextCursor ? (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loadingMore}
                onClick={() => void handleLoadMore()}
              >
                {loadingMore ? "読み込み中…" : "もっと見る"}
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
  );
}
