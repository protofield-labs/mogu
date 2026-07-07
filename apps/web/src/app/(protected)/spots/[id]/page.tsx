import type { Metadata } from "next";

import { SpotDetailPageView } from "@/components/spots/spot-detail-page-view";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "スポット | mogu",
    description: "友達と共有したお店の記録",
    openGraph: {
      title: "スポット | mogu",
      description: "友達と共有したお店の記録",
    },
  };
}

export default async function SpotDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <SpotDetailPageView spotId={id} />;
}
