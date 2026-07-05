import "server-only";

import { withAuthRls } from "@/lib/auth/with-auth-rls";

export type FlagNotificationDto = {
  type: "recollected";
  count: number;
  isAnonymous: boolean;
  weekOf: string;
};

/** Validate a real calendar date; DB-side date_trunc snaps it to the week start. */
function normalizeWeekStart(weekOf: string): string | null {
  const parsed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekOf.trim());
  if (!parsed) {
    return null;
  }
  const [value, year, month, day] = parsed;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return null;
  }
  return value;
}

/** Weekly flag inbox summary for the authenticated recipient (#38). */
export async function listFlagNotifications(
  uid: string,
  weekOf?: string | null,
): Promise<FlagNotificationDto[] | null> {
  const normalizedWeek = weekOf ? normalizeWeekStart(weekOf) : null;
  if (weekOf && !normalizedWeek) {
    return null;
  }

  return withAuthRls(uid, async (tx) => {
    if (normalizedWeek) {
      const rows = await tx.$queryRaw<
        { count: bigint; is_anonymous: boolean; week_of: Date }[]
      >`
        SELECT
          count(*)::bigint AS count,
          f.is_anonymous,
          date_trunc('week', f.created_at AT TIME ZONE 'UTC')::date AS week_of
        FROM flags f
        WHERE f.recipient_id = app_current_user()
          AND date_trunc('week', f.created_at AT TIME ZONE 'UTC')::date
            = date_trunc('week', ${normalizedWeek}::date)::date
        GROUP BY date_trunc('week', f.created_at AT TIME ZONE 'UTC'), f.is_anonymous
        ORDER BY f.is_anonymous ASC
      `;
      return rows.map((row) => ({
        type: "recollected" as const,
        count: Number(row.count),
        isAnonymous: row.is_anonymous,
        weekOf: row.week_of.toISOString().slice(0, 10),
      }));
    }

    const rows = await tx.$queryRaw<
      { count: bigint; is_anonymous: boolean; week_of: Date }[]
    >`
      SELECT
        count(*)::bigint AS count,
        f.is_anonymous,
        date_trunc('week', f.created_at AT TIME ZONE 'UTC')::date AS week_of
      FROM flags f
      WHERE f.recipient_id = app_current_user()
      GROUP BY date_trunc('week', f.created_at AT TIME ZONE 'UTC'), f.is_anonymous
      ORDER BY week_of DESC, f.is_anonymous ASC
    `;

    return rows.map((row) => ({
      type: "recollected" as const,
      count: Number(row.count),
      isAnonymous: row.is_anonymous,
      weekOf: row.week_of.toISOString().slice(0, 10),
    }));
  });
}

/** Mark flag notifications read (#38). Empty ids marks all unread for recipient. */
export async function markFlagsRead(
  uid: string,
  ids?: string[],
): Promise<number> {
  return withAuthRls(uid, async (tx) => {
    const result = await tx.flag.updateMany({
      where: {
        recipientId: uid,
        readAt: null,
        ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
      },
      data: { readAt: new Date() },
    });
    return result.count;
  });
}
