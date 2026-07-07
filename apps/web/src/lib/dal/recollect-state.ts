import "server-only";

import type { Prisma } from "@prisma/client";

/** Source spot ids the viewer has already recollected. */
export async function getSavedSourceSpotIds(
  tx: Prisma.TransactionClient,
  viewerUid: string,
  sourceSpotIds: string[],
): Promise<Set<string>> {
  if (sourceSpotIds.length === 0) {
    return new Set();
  }

  const edges = await tx.recollectionEdge.findMany({
    where: {
      actorId: viewerUid,
      sourceSpotId: { in: sourceSpotIds },
    },
    select: { sourceSpotId: true },
  });

  return new Set(
    edges
      .map((edge) => edge.sourceSpotId)
      .filter((id): id is string => id !== null),
  );
}

/** Whether the viewer has recollected a single source spot. */
export async function hasRecollectedSourceSpot(
  tx: Prisma.TransactionClient,
  viewerUid: string,
  sourceSpotId: string,
): Promise<boolean> {
  const saved = await getSavedSourceSpotIds(tx, viewerUid, [sourceSpotId]);
  return saved.has(sourceSpotId);
}
