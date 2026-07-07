import type { Metadata } from "next";

import { CollectionPageView } from "@/components/collections/collection-page-view";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ spotId?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "コレクション | mogu",
    description: "友達と共有したお店のコレクション",
    openGraph: {
      title: "コレクション | mogu",
      description: "友達と共有したお店のコレクション",
    },
  };
}

export default async function CollectionPage({
  params,
  searchParams,
}: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return (
    <CollectionPageView collectionId={id} initialSpotId={query.spotId ?? null} />
  );
}
