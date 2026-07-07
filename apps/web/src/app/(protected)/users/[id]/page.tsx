import { FriendProfileView } from "@/components/users/friend-profile-view";
import { FRIENDS_FROM_HOME } from "@/lib/friends/paths";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
};

export default async function FriendProfilePage({
  params,
  searchParams,
}: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return (
    <FriendProfileView
      userId={id}
      fromHome={query.from === FRIENDS_FROM_HOME}
    />
  );
}
