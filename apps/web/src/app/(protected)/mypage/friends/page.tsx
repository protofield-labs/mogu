import { FriendsView } from "@/components/mypage/friends-view";
import { FRIENDS_FROM_HOME } from "@/lib/friends/paths";

type PageProps = {
  searchParams: Promise<{ from?: string }>;
};

export default async function MypageFriendsPage({ searchParams }: PageProps) {
  const query = await searchParams;
  return <FriendsView fromHome={query.from === FRIENDS_FROM_HOME} />;
}
