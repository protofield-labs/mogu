"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { FriendsViewSkeleton } from "@/components/loading/skeletons";
import {
  friendAvatarProps,
  IncomingFriendRequestList,
} from "@/components/mypage/incoming-friend-request-list";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { SpotPlaceName } from "@/components/places/spot-place-name";
import { notifyBadgesUpdated } from "@/lib/mypage/badge-events";
import {
  acceptFriendRequest,
  fetchFlagEvents,
  fetchIncomingFriendRequests,
  fetchMeBadges,
  markFlagsRead,
  rejectFriendRequest,
} from "@/lib/mypage/browser-api";
import {
  flagEventHref,
  formatFlagEventMessage,
  formatRelativeTime,
} from "@/lib/mypage/notifications";
import type { FlagEvent, FriendRequest } from "@/lib/mypage/types";
import { cn } from "@/lib/utils";

type RequestAction = "accept" | "reject";

function FlagEventRow({ event }: { event: FlagEvent }) {
  const href = flagEventHref(event);
  const message = formatFlagEventMessage(event);
  const spotFallback = event.spotComment || "スポット";
  const content = (
    <>
      {event.isAnonymous || !event.actor ? (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-dashed border-border bg-background text-xs font-medium text-muted-foreground">
          ?
        </span>
      ) : (
        <Avatar {...friendAvatarProps(event.actor, { showInitial: true })} />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{message}</p>
        {event.placeId ? (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            <SpotPlaceName placeId={event.placeId} fallback={spotFallback} />
          </p>
        ) : null}
        <p className="mt-1 text-xs text-muted-foreground">
          {formatRelativeTime(event.createdAt)}
        </p>
      </div>
    </>
  );

  if (!href) {
    return (
      <li className="flex items-center gap-3 rounded-2xl border border-border bg-mogu-surface-elevated p-4">
        {content}
      </li>
    );
  }

  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-2xl border border-border bg-mogu-surface-elevated p-4 transition-colors hover:bg-muted/30"
      >
        {content}
      </Link>
    </li>
  );
}

export function NotificationsView() {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [flagEvents, setFlagEvents] = useState<FlagEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [busyPairId, setBusyPairId] = useState<string | null>(null);
  const [busyRequestAction, setBusyRequestAction] = useState<RequestAction | null>(
    null,
  );

  const loadNotifications = useCallback(async () => {
    const [incoming, events] = await Promise.all([
      fetchIncomingFriendRequests(),
      fetchFlagEvents(),
    ]);
    setRequests(incoming);
    setFlagEvents(events);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [incoming, events, badges] = await Promise.all([
          fetchIncomingFriendRequests(),
          fetchFlagEvents(),
          fetchMeBadges().catch(() => null),
        ]);

        if (cancelled) {
          return;
        }

        setRequests(incoming);
        setFlagEvents(events);

        if (badges && badges.unreadFlags > 0) {
          try {
            await markFlagsRead();
            notifyBadgesUpdated();
          } catch {
            // Best-effort read state; timeline remains visible.
          }
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
  }, [reloadToken]);

  async function handleAccept(pairId: string) {
    setBusyPairId(pairId);
    setBusyRequestAction("accept");
    setError(null);
    try {
      await acceptFriendRequest(pairId);
      notifyBadgesUpdated();
      await loadNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : "承認に失敗しました");
    } finally {
      setBusyPairId(null);
      setBusyRequestAction(null);
    }
  }

  async function handleReject(pairId: string) {
    setBusyPairId(pairId);
    setBusyRequestAction("reject");
    setError(null);
    try {
      await rejectFriendRequest(pairId);
      notifyBadgesUpdated();
      await loadNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : "拒否に失敗しました");
    } finally {
      setBusyPairId(null);
      setBusyRequestAction(null);
    }
  }

  function handleRetryLoad() {
    setLoading(true);
    setLoadError(null);
    setReloadToken((current) => current + 1);
  }

  if (loading) {
    return <FriendsViewSkeleton />;
  }

  if (loadError) {
    return <LoadErrorState message={loadError} onRetry={handleRetryLoad} />;
  }

  const isEmpty = requests.length === 0 && flagEvents.length === 0;

  return (
    <div className="flex flex-1 flex-col gap-6 pb-mogu-screen-y">
      <header className="flex items-center gap-3 px-mogu-screen-x pt-3">
        <Link
          href="/"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-mogu-surface-elevated"
          aria-label="ホームに戻る"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="text-base font-semibold text-foreground">通知</h1>
      </header>

      {error ? (
        <p className="px-mogu-screen-x text-sm text-destructive">{error}</p>
      ) : null}

      {isEmpty ? (
        <EmptyState className="mx-mogu-screen-x p-6">
          新しい通知はありません。
        </EmptyState>
      ) : (
        <div className="space-y-6 px-mogu-screen-x">
          <IncomingFriendRequestList
            requests={requests}
            busyPairId={busyPairId}
            busyRequestAction={busyRequestAction}
            onAccept={(pairId) => void handleAccept(pairId)}
            onReject={(pairId) => void handleReject(pairId)}
          />

          {flagEvents.length > 0 ? (
            <section>
              <h2 className="text-xs font-medium text-muted-foreground">フラグ</h2>
              <ul className={cn("mt-2 space-y-3", requests.length > 0 && "pt-1")}>
                {flagEvents.map((event) => (
                  <FlagEventRow key={event.id} event={event} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
