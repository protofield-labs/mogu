import {
  getCollectionDetail,
  listMyCollections,
} from "@/lib/collections/browser-api";
import {
  dedupeSpotsForMap,
  mergeCollectionSpots,
} from "@/lib/mypage/all-my-spots";

export async function loadAllMySpots() {
  const collections = await listMyCollections();
  if (collections.length === 0) {
    return {
      spots: [],
      mapSpots: [],
      collectionNameBySpotId: {} as Record<string, string>,
    };
  }

  const details = (
    await Promise.allSettled(
      collections.map((collection) => getCollectionDetail(collection.id)),
    )
  ).flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));

  if (details.length === 0) {
    throw new Error("コレクションを読み込めませんでした");
  }
  const { spots, collectionNameBySpotId } = mergeCollectionSpots(details);

  return {
    spots,
    mapSpots: dedupeSpotsForMap(spots),
    collectionNameBySpotId,
  };
}
