import { checkDbConnection } from "@/lib/db/pool";

export const dynamic = "force-dynamic";

export default async function Home() {
  const db = await checkDbConnection();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white text-gray-900">
      <h1 className="text-4xl font-bold tracking-tight">mogu</h1>
      <p className="text-lg text-gray-600">Hello</p>
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
