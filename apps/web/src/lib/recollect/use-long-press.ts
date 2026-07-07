"use client";

import { useCallback, useRef } from "react";

type UseLongPressOptions = {
  onClick: () => void;
  onLongPress: () => void;
  delayMs?: number;
};

/** Distinguish short tap (quick save) from long press (open picker). */
export function useLongPress({
  onClick,
  onLongPress,
  delayMs = 500,
}: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startPress = useCallback(() => {
    longPressRef.current = false;
    clearTimer();
    timerRef.current = setTimeout(() => {
      longPressRef.current = true;
      onLongPress();
    }, delayMs);
  }, [clearTimer, delayMs, onLongPress]);

  const endPress = useCallback(() => {
    clearTimer();
    if (!longPressRef.current) {
      onClick();
    }
    longPressRef.current = false;
  }, [clearTimer, onClick]);

  const cancelPress = useCallback(() => {
    clearTimer();
    longPressRef.current = false;
  }, [clearTimer]);

  return {
    onPointerDown: startPress,
    onPointerUp: endPress,
    onPointerLeave: cancelPress,
    onPointerCancel: cancelPress,
  };
}
