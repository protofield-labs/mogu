/** Normalize caught errors for user-facing load messages (#338). */
export function formatLoadError(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}
