"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const PULL_THRESHOLD_PX = 64;
const PULL_MAX_PX = 96;

type PullToRefreshProps = {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
};

export function PullToRefresh({
  onRefresh,
  children,
  className,
  disabled = false,
}: PullToRefreshProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const startYRef = useRef(0);

  const isAtTop = useCallback(() => {
    const element = scrollRef.current;
    return element ? element.scrollTop <= 0 : false;
  }, []);

  const handleTouchStart = useCallback(
    (event: TouchEvent) => {
      if (disabled || refreshing || !isAtTop()) {
        pullingRef.current = false;
        return;
      }
      startYRef.current = event.touches[0]?.clientY ?? 0;
      pullingRef.current = true;
    },
    [disabled, refreshing, isAtTop],
  );

  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      if (!pullingRef.current || disabled || refreshing) {
        return;
      }
      const currentY = event.touches[0]?.clientY ?? 0;
      const delta = currentY - startYRef.current;
      if (delta > 0 && isAtTop()) {
        const distance = Math.min(delta * 0.45, PULL_MAX_PX);
        pullDistanceRef.current = distance;
        setPullDistance(distance);
      } else {
        pullingRef.current = false;
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    },
    [disabled, refreshing, isAtTop],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pullingRef.current) {
      return;
    }
    pullingRef.current = false;

    const distance = pullDistanceRef.current;
    if (distance >= PULL_THRESHOLD_PX && !disabled && !refreshing) {
      setRefreshing(true);
      pullDistanceRef.current = PULL_THRESHOLD_PX;
      setPullDistance(PULL_THRESHOLD_PX);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
      return;
    }

    pullDistanceRef.current = 0;
    setPullDistance(0);
  }, [disabled, onRefresh, refreshing]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    element.addEventListener("touchstart", handleTouchStart, { passive: true });
    element.addEventListener("touchmove", handleTouchMove, { passive: true });
    element.addEventListener("touchend", handleTouchEnd);
    element.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
      element.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [handleTouchEnd, handleTouchMove, handleTouchStart]);

  const showIndicator = pullDistance > 0 || refreshing;

  return (
    <div
      ref={scrollRef}
      className={cn("relative min-h-0 flex-1 overflow-y-auto", className)}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center transition-opacity duration-150 motion-reduce:transition-none",
          showIndicator ? "opacity-100" : "opacity-0",
        )}
        style={{
          height: Math.max(pullDistance, refreshing ? PULL_THRESHOLD_PX : 0),
        }}
      >
        <div className="flex items-end pb-2">
          <Spinner
            size="md"
            label={refreshing ? "更新中" : undefined}
          />
        </div>
      </div>
      <div
        className="transition-transform duration-150 ease-out motion-reduce:transition-none"
        style={{
          transform:
            pullDistance > 0 || refreshing
              ? `translateY(${refreshing ? PULL_THRESHOLD_PX : pullDistance}px)`
              : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
