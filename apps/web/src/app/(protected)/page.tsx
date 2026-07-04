import { checkDbConnection } from "@/lib/db/pool";

import { HomeContent } from "@/components/home-content";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const db = await checkDbConnection();

  return (
    <main className="flex min-h-[calc(100vh-3.25rem)] flex-col items-center justify-center gap-6 bg-white px-4 text-gray-900">
      <HomeContent />
      <p className="text-sm text-gray-500">
        DB:{" "}
        {db.ok ? (
          <span className="text-green-700">connected ({db.serverTime})</span>
        ) : (
          <span className="text-amber-700">{db.error}</span>
        )}
      </p>
    </main>
  );
}
