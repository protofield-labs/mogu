import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ spotId?: string }>;
};

export default async function LegacyCollectionDetailPage({
  params,
  searchParams,
}: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const suffix = query.spotId
    ? `?spotId=${encodeURIComponent(query.spotId)}`
    : "";
  redirect(`/collections/${encodeURIComponent(id)}${suffix}`);
}
