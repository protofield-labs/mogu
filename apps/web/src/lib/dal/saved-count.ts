import "server-only";

import type { PrismaTransaction } from "@/lib/db/prisma";

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
