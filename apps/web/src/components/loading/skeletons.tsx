import { TabBar } from "@/components/tab-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function LoadingShell({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      aria-busy="true"
      aria-label={label}
      className={cn("flex min-h-0 flex-1 flex-col", className)}
    >
      {children}
    </div>
  );
}

/** AuthGate / OnboardingGate — matches AppShell to reduce layout shift. */
export function AppShellSkeleton({ label = "読み込み中" }: { label?: string }) {
  return (
    <div className="flex min-h-dvh justify-center bg-background">
      <div className="flex h-dvh w-full max-w-mogu-shell flex-col bg-mogu-surface">
        <main
          aria-busy="true"
          aria-label={label}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-[env(safe-area-inset-top)]"
        >
          <HomeViewSkeleton embedded />
        </main>
        <TabBar />
      </div>
    </div>
  );
}

/** Login / signup session check — mirrors auth card layout. */
export function AuthFormSkeleton({ label = "認証状態を確認しています" }: { label?: string }) {
  return (
    <main className="flex min-h-dvh justify-center bg-background">
      <div className="flex min-h-dvh w-full max-w-mogu-shell flex-col justify-center px-mogu-screen-x py-10">
        <div
          aria-busy="true"
          aria-label={label}
          className="space-y-6 rounded-3xl bg-mogu-surface-elevated p-6 shadow-mogu-card sm:p-8"
        >
          <div className="space-y-2">
            <Skeleton className="h-4 w-12 rounded-lg" />
            <Skeleton className="h-8 w-32 rounded-xl" />
            <Skeleton className="h-4 w-full max-w-xs rounded-lg" />
          </div>
          <Skeleton className="h-11 w-full rounded-2xl" />
          <Skeleton className="h-3 w-12 mx-auto rounded-full" />
          <div className="space-y-4">
            <Skeleton className="h-11 w-full rounded-2xl" />
            <Skeleton className="h-11 w-full rounded-2xl" />
            <Skeleton className="h-11 w-full rounded-2xl" />
          </div>
          <Skeleton className="mx-auto h-4 w-48 rounded-lg" />
        </div>
      </div>
    </main>
  );
}

/** Onboarding profile bootstrap. */
export function OnboardingFormSkeleton({
  label = "プロフィールを準備しています",
}: {
  label?: string;
}) {
  return (
    <main className="flex min-h-dvh justify-center bg-background">
      <div className="flex min-h-dvh w-full max-w-mogu-shell flex-col justify-center px-6 py-10">
        <div
          aria-busy="true"
          aria-label={label}
          className="rounded-3xl bg-mogu-surface-elevated p-6 shadow-mogu-card"
        >
          <div className="space-y-2">
            <Skeleton className="h-4 w-16 rounded-lg" />
            <Skeleton className="h-8 w-56 rounded-xl" />
            <Skeleton className="h-4 w-full max-w-sm rounded-lg" />
          </div>
          <div className="mt-6 space-y-6">
            <Skeleton className="h-11 w-full rounded-2xl" />
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="aspect-square rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-11 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </main>
  );
}

export function HomeViewSkeleton({ embedded = false }: { embedded?: boolean }) {
  const content = (
    <LoadingShell label="ホームを読み込んでいます" className="gap-5 py-mogu-screen-y">
      <header className="flex items-center justify-between px-mogu-screen-x">
        <Skeleton className="h-5 w-12 rounded-lg" />
        <Skeleton className="size-9 rounded-full" />
      </header>

      <div className="flex gap-3 overflow-hidden px-mogu-screen-x">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex w-16 shrink-0 flex-col items-center gap-1">
            <Skeleton className="size-12 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
        ))}
      </div>

      <Skeleton className="mx-mogu-screen-x h-14 rounded-2xl" />

      <section className="space-y-3 px-mogu-screen-x">
        <Skeleton className="h-4 w-24 rounded-lg" />
        <Skeleton className="h-52 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </section>
    </LoadingShell>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="flex min-h-dvh justify-center bg-background">
      <div className="flex h-dvh w-full max-w-mogu-shell flex-col bg-mogu-surface">
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-[env(safe-area-inset-top)]">
          {content}
        </main>
        <TabBar />
      </div>
    </div>
  );
}

export function MypageViewSkeleton() {
  return (
    <LoadingShell label="プロフィールを読み込んでいます" className="gap-5 pb-mogu-screen-y">
      <div className="flex items-center justify-between px-mogu-screen-x pt-4">
        <Skeleton className="h-8 w-36 rounded-lg" />
        <Skeleton className="size-10 rounded-full" />
      </div>

      <Skeleton className="mx-mogu-screen-x h-44 rounded-mogu-card" />

      <div className="grid grid-cols-2 gap-3 px-mogu-screen-x">
        <Skeleton className="h-40 rounded-mogu-card" />
        <Skeleton className="h-40 rounded-mogu-card" />
      </div>

      <div className="space-y-3 px-mogu-screen-x pt-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32 rounded-lg" />
          <Skeleton className="h-7 w-32 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-mogu-card" />
          ))}
        </div>
      </div>
    </LoadingShell>
  );
}

export function FriendsViewSkeleton() {
  return (
    <LoadingShell label="友達を読み込んでいます" className="gap-6 pb-mogu-screen-y">
      <header className="flex items-center gap-3 px-mogu-screen-x pt-3">
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="h-5 w-12 flex-1 rounded-lg" />
        <Skeleton className="h-7 w-12 rounded-full" />
      </header>

      <Skeleton className="mx-mogu-screen-x h-11 rounded-2xl" />

      <div className="space-y-2 px-mogu-screen-x">
        <Skeleton className="h-3 w-16 rounded-lg" />
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-16 rounded-2xl" />
        ))}
      </div>
    </LoadingShell>
  );
}

export function CollectionDetailSkeleton() {
  return (
    <LoadingShell label="コレクションを読み込んでいます" className="gap-6 pb-mogu-screen-y">
      <header className="flex items-center gap-3 px-mogu-screen-x pt-3">
        <Skeleton className="size-9 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-40 rounded-lg" />
          <Skeleton className="h-3 w-12 rounded-lg" />
        </div>
      </header>

      <Skeleton className="mx-mogu-screen-x h-48 rounded-3xl" />

      <div className="space-y-3 px-mogu-screen-x">
        <Skeleton className="h-4 w-24 rounded-lg" />
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-2xl" />
        ))}
      </div>
    </LoadingShell>
  );
}

export function AgentChatSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="セッションを準備しています"
      className="flex flex-col gap-4 py-2"
    >
      <div className="flex items-start gap-2">
        <Skeleton className="size-8 shrink-0 rounded-full" />
        <Skeleton className="h-16 w-3/4 max-w-xs rounded-2xl" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-10 w-2/5 max-w-[10rem] rounded-2xl" />
      </div>
      <div className="flex items-start gap-2">
        <Skeleton className="size-8 shrink-0 rounded-full" />
        <Skeleton className="h-24 w-4/5 max-w-sm rounded-2xl" />
      </div>
    </div>
  );
}
