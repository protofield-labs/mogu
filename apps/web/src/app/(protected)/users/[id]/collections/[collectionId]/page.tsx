import { FriendCollectionDetailView } from "@/components/users/friend-collection-detail-view";

type PageProps = {
  params: Promise<{ id: string; collectionId: string }>;
};

export default async function FriendCollectionDetailPage({ params }: PageProps) {
  const { id, collectionId } = await params;
  return (
    <FriendCollectionDetailView ownerId={id} collectionId={collectionId} />
  );
}
