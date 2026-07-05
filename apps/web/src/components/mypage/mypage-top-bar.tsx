"use client";

export function MypageTopBar() {
  return (
    <header className="flex items-center justify-between px-mogu-screen-x py-3">
      <span className="text-lg font-semibold tracking-tight text-foreground">mogu</span>
      <span className="rounded-full border border-border bg-mogu-surface-elevated px-3 py-1 text-xs font-medium text-muted-foreground">
        中目黒・恵比寿
      </span>
    </header>
  );
}
