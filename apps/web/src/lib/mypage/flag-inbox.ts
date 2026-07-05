import type { FlagNotification } from "@/lib/mypage/types";

export type WeeklyFlagSummary = {
  weekOf: string | null;
  totalCount: number;
  namedCount: number;
  anonymousCount: number;
  namedRows: FlagNotification[];
  anonymousRows: FlagNotification[];
};

/** ISO week start (Monday) in UTC as YYYY-MM-DD. */
export function getUtcWeekStart(date: Date = new Date()): string {
  const utc = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = utc.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  utc.setUTCDate(utc.getUTCDate() + diff);
  return utc.toISOString().slice(0, 10);
}

export function pickWeekNotifications(
  notifications: FlagNotification[],
  weekOf: string,
): FlagNotification[] {
  return notifications.filter((row) => row.weekOf === weekOf);
}

export function summarizeWeeklyFlags(
  notifications: FlagNotification[],
  weekOf: string = getUtcWeekStart(),
): WeeklyFlagSummary {
  const rows = pickWeekNotifications(notifications, weekOf);
  const namedRows = rows.filter((row) => !row.isAnonymous);
  const anonymousRows = rows.filter((row) => row.isAnonymous);
  const namedCount = namedRows.reduce((sum, row) => sum + row.count, 0);
  const anonymousCount = anonymousRows.reduce((sum, row) => sum + row.count, 0);

  return {
    weekOf: rows.length > 0 ? weekOf : null,
    totalCount: namedCount + anonymousCount,
    namedCount,
    anonymousCount,
    namedRows,
    anonymousRows,
  };
}

export function formatWeeklyHeadline(totalCount: number): string {
  return `今週、スポットが${totalCount}回保存されました`;
}

export function formatNamedFlagLine(count: number): string {
  return count === 1 ? "保存されました" : `保存されました ×${count}`;
}

export function formatAnonymousFlagLine(count: number): string {
  return count === 1 ? "誰かが保存しました" : `誰かが保存しました ×${count}`;
}

export function shouldShowFlagInbox(summary: WeeklyFlagSummary): boolean {
  return summary.totalCount > 0;
}
