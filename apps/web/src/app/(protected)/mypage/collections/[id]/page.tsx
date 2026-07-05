import { CollectionDetailView } from "@/components/mypage/collection-detail-view";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CollectionDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <CollectionDetailView collectionId={id} />;
}
