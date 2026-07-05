import { checkDbConnection } from "@/lib/db/pool";

import { HomeContent } from "@/components/home-content";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const db = await checkDbConnection();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-mogu-screen-x py-mogu-screen-y text-foreground">
      <HomeContent />
      <p className="text-sm text-muted-foreground">
        DB:{" "}
        {db.ok ? (
          <span className="text-foreground">connected ({db.serverTime})</span>
        ) : (
          <span className="text-destructive">{db.error}</span>
        )}
      </p>
    </div>
  );
}
