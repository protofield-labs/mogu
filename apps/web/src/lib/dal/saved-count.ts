import "server-only";

import type { PrismaTransaction } from "@/lib/db/prisma";
import { toUserDto, type UserDto } from "@/lib/dal/users";

export const SAVED_SAVER_PREVIEW_LIMIT = 3;

/** erd-api §5: distinct savers in the viewer's circle for one place_id. */
export async function countSavedInCircle(
  tx: PrismaTransaction,
  placeId: string,
): Promise<number> {
  const rows = await tx.$queryRaw<{ count: bigint }[]>`
    SELECT count(DISTINCT s.added_by)::bigint AS count
    FROM spots s
    WHERE s.place_id = ${placeId}
      AND (
        s.added_by = app_current_user()
        OR are_friends(s.added_by, app_current_user())
      )
  `;
  return Number(rows[0]?.count ?? 0n);
}

/** Batch variant for collection detail / feed assembly. */
export async function countSavedInCircleByPlaceIds(
  tx: PrismaTransaction,
  placeIds: string[],
): Promise<Map<string, number>> {
  if (placeIds.length === 0) {
    return new Map();
  }

  const rows = await tx.$queryRaw<{ place_id: string; count: bigint }[]>`
    SELECT s.place_id, count(DISTINCT s.added_by)::bigint AS count
    FROM spots s
    WHERE s.place_id = ANY(${placeIds}::text[])
      AND (
        s.added_by = app_current_user()
        OR are_friends(s.added_by, app_current_user())
      )
    GROUP BY s.place_id
  `;

  return new Map(rows.map((row) => [row.place_id, Number(row.count)]));
}

type SavedSaverRow = {
  place_id: string;
  firebase_uid: string;
  display_name: string;
  avatar_color: string;
  avatar_url: string | null;
};

/** Recent distinct savers per place_id for feed avatar stacks (#205). */
export async function listSavedInCircleByPlaceIds(
  tx: PrismaTransaction,
  placeIds: string[],
  limitPerPlace = SAVED_SAVER_PREVIEW_LIMIT,
): Promise<Map<string, UserDto[]>> {
  if (placeIds.length === 0) {
    return new Map();
  }

  const rows = await tx.$queryRaw<SavedSaverRow[]>`
    WITH saver_rank AS (
      SELECT
        s.place_id,
        s.added_by,
        MAX(s.created_at) AS latest_save
      FROM spots s
      WHERE s.place_id = ANY(${placeIds}::text[])
        AND (
          s.added_by = app_current_user()
          OR are_friends(s.added_by, app_current_user())
        )
      GROUP BY s.place_id, s.added_by
    ),
    ranked AS (
      SELECT
        sr.place_id,
        sr.added_by,
        ROW_NUMBER() OVER (
          PARTITION BY sr.place_id
          ORDER BY sr.latest_save DESC, sr.added_by
        ) AS rank
      FROM saver_rank sr
    )
    SELECT
      r.place_id,
      u.firebase_uid,
      u.display_name,
      u.avatar_color,
      u.avatar_url
    FROM ranked r
    JOIN users u ON u.firebase_uid = r.added_by
    WHERE r.rank <= ${limitPerPlace}
    ORDER BY r.place_id, r.rank
  `;

  const grouped = new Map<string, UserDto[]>();
  for (const row of rows) {
    const savers = grouped.get(row.place_id) ?? [];
    savers.push(
      toUserDto({
        firebaseUid: row.firebase_uid,
        displayName: row.display_name,
        avatarColor: row.avatar_color,
        avatarUrl: row.avatar_url,
      }),
    );
    grouped.set(row.place_id, savers);
  }

  return grouped;
}
