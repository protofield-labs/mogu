import type { ReactNode } from "react";

import { TabBar } from "@/components/tab-bar";

export type AppShellProps = {
  children: ReactNode;
  /** マイページタブの赤ドット（#37 で API 接続、ここでは props のみ） */
  showMypageBadge?: boolean;
};

/**
 * 下部3タブ + 100dvh + セーフエリア + PC 中央寄せ (#53).
 * `(protected)` 配下の全画面に適用する。
 */
export function AppShell({ children, showMypageBadge = false }: AppShellProps) {
  return (
    <div className="flex min-h-dvh justify-center bg-background">
      <div className="flex h-dvh w-full max-w-mogu-shell flex-col bg-mogu-surface">
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-[env(safe-area-inset-top)]">
          {children}
        </main>
        <TabBar showMypageBadge={showMypageBadge} />
      </div>
    </div>
  );
}
