"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { AvatarRow } from "@/components/home/avatar-row";
import { FeedCompactRow } from "@/components/home/feed-compact-row";
import { FeedHeroCard } from "@/components/home/feed-hero-card";
import { HomeEmptyState } from "@/components/home/home-empty-state";
import { RecommendationCompactRow } from "@/components/home/recommendation-compact-row";
import { Button } from "@/components/ui/button";
import { fetchFeedPage, fetchHomeRecommendation } from "@/lib/home/browser-api";
import {
  getLastReadFeedAt,
  markFeedRead,
  shouldShowSoloEmptyState,
} from "@/lib/home/feed-read";
import type { FeedItem, Recommendation } from "@/lib/home/types";
import { fetchFriends, fetchMe } from "@/lib/mypage/browser-api";
import type { FriendUser, MeProfile } from "@/lib/mypage/types";

export function HomeView() {
  const [me, setMe] = useState<MeProfile | null>(null);
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [lastReadAt, setLastReadAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [profile, friendList, feedPage, homeRecommendation] =
          await Promise.all([
            fetchMe(),
            fetchFriends(),
            fetchFeedPage(),
            fetchHomeRecommendation().catch(() => null),
          ]);

        if (cancelled) {
          return;
        }

        setMe(profile);
        setFriends(friendList);
        setFeedItems(feedPage.items);
        setNextCursor(feedPage.nextCursor);
        setRecommendation(homeRecommendation);
        setLastReadAt(getLastReadFeedAt());
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
  }, []);

  useEffect(() => {
    return () => {
      markFeedRead();
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

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center px-mogu-screen-x py-mogu-screen-y text-sm text-muted-foreground">
        読み込み中…
      </div>
    );
  }

  if (error && !me) {
    return (
      <div className="flex flex-1 items-center justify-center px-mogu-screen-x py-mogu-screen-y">
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      </div>
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
      </header>

      <AvatarRow
        friends={friends}
        feedItems={feedItems}
        lastReadAt={lastReadAt}
      />

      {recommendation ? (
        <RecommendationCompactRow recommendation={recommendation} />
      ) : (
        <Link
          href="/search"
          className="mx-mogu-screen-x flex items-center justify-between rounded-2xl border border-dashed border-border bg-mogu-surface-elevated px-4 py-3 text-sm text-foreground"
        >
          <span>今夜どこ行く？ 検索で断言を見る</span>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        </Link>
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

          {heroItem ? <FeedHeroCard item={heroItem} /> : null}

          {compactItems.length > 0 ? (
            <div className="space-y-2">
              {compactItems.map((item) => (
                <FeedCompactRow key={item.spot.id} item={item} />
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
        <p className="px-mogu-screen-x text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
