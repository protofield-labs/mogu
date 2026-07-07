import { FriendProfileView } from "@/components/users/friend-profile-view";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function FriendProfilePage({ params }: PageProps) {
  const { id } = await params;
  return <FriendProfileView userId={id} />;
}
