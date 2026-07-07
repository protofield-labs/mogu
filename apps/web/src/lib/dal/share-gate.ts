import "server-only";

import { withAuthRls } from "@/lib/auth/with-auth-rls";
import { normalizeFriendshipPair } from "@/lib/friendship/pair";

export type ShareGateDto = {
  ownerId: string;
  ownerDisplayName: string;
  collectionName: string;
};

type ShareGateRow = {
  owner_id: string;
  owner_display_name: string;
  collection_name: string;
};

export async function getCollectionShareGate(
  viewerUid: string,
  collectionId: string,
): Promise<ShareGateDto | null> {
  const rows = await withAuthRls(viewerUid, (tx) =>
    tx.$queryRaw<ShareGateRow[]>`
      SELECT owner_id, owner_display_name, collection_name
      FROM get_collection_share_gate(${viewerUid}, ${collectionId}::uuid)
    `,
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    ownerId: row.owner_id,
    ownerDisplayName: row.owner_display_name,
    collectionName: row.collection_name,
  };
}

export async function getSpotShareGate(
  viewerUid: string,
  spotId: string,
): Promise<ShareGateDto | null> {
  const rows = await withAuthRls(viewerUid, (tx) =>
    tx.$queryRaw<ShareGateRow[]>`
      SELECT owner_id, owner_display_name, collection_name
      FROM get_spot_share_gate(${viewerUid}, ${spotId}::uuid)
    `,
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    ownerId: row.owner_id,
    ownerDisplayName: row.owner_display_name,
    collectionName: row.collection_name,
  };
}

export type UserShareGateDto = {
  ownerId: string;
  ownerDisplayName: string;
};

/** Non-friend profile gate metadata (#122). */
export async function getUserShareGate(
  viewerUid: string,
  targetUid: string,
): Promise<UserShareGateDto | null> {
  if (viewerUid === targetUid) {
    return null;
  }

  return withAuthRls(viewerUid, async (tx) => {
    const user = await tx.user.findUnique({
      where: { firebaseUid: targetUid },
      select: { displayName: true },
    });
    if (!user) {
      return null;
    }

    const pair = normalizeFriendshipPair(viewerUid, targetUid);
    const friendship = await tx.friendship.findUnique({
      where: { userLow_userHigh: pair },
      select: { status: true },
    });
    if (friendship?.status === "accepted") {
      return null;
    }

    return {
      ownerId: targetUid,
      ownerDisplayName: user.displayName,
    };
  });
}
