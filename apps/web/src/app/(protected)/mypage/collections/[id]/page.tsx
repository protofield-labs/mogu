import { CollectionDetailView } from "@/components/mypage/collection-detail-view";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ spotId?: string }>;
};

export default async function CollectionDetailPage({
  params,
  searchParams,
}: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return (
    <CollectionDetailView collectionId={id} initialSpotId={query.spotId ?? null} />
  );
}
