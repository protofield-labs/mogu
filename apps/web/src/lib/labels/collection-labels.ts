import type { CollectionVisibility } from "@/lib/collections/browser-api";

const VISIBILITY_LABELS: Record<CollectionVisibility, string> = {
  friends: "友達に公開",
  secret: "自分だけ",
};

export function formatCollectionVisibility(
  visibility: CollectionVisibility,
): string {
  return VISIBILITY_LABELS[visibility];
}
