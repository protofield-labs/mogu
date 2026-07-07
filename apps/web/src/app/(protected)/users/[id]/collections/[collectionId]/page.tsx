import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string; collectionId: string }>;
};

export default async function LegacyFriendCollectionPage({ params }: PageProps) {
  const { collectionId } = await params;
  redirect(`/collections/${encodeURIComponent(collectionId)}`);
}
