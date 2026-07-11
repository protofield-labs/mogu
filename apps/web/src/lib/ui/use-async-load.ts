"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

import { formatLoadError } from "@/lib/ui/load-error";

type UseAsyncLoadEffectOptions = {
  /** When false, the effect does not run (e.g. wait for auth/profile). */
  enabled?: boolean;
};

type UseAsyncLoadEffectResult = {
  loading: boolean;
  error: string | null;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
};

/**
 * Mount-safe async loader with cancelled guard (#338).
 * Include `reloadToken` in deps to retrigger (increment on retry).
 */
export function useAsyncLoadEffect(
  loader: (isCancelled: () => boolean) => Promise<void>,
  deps: readonly unknown[],
  options?: UseAsyncLoadEffectOptions,
): UseAsyncLoadEffectResult {
  const enabled = options?.enabled ?? true;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    const isCancelled = () => cancelled;

    void (async () => {
      try {
        await loader(isCancelled);
      } catch (err) {
        if (!cancelled) {
          setError(formatLoadError(err, "読み込みに失敗しました"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller supplies deps
  }, [enabled, ...deps]);

  return { loading, error, setLoading, setError };
}
