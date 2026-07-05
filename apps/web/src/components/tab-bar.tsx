"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Sparkles, User } from "lucide-react";

import { cn } from "@/lib/utils";

type TabBarProps = {
  showMypageBadge?: boolean;
};

type TabItem = {
  href: string;
  label: string;
  icon: typeof Home;
  isActive: (pathname: string) => boolean;
  center?: boolean;
  showBadge?: boolean;
};

export function TabBar({ showMypageBadge = false }: TabBarProps) {
  const pathname = usePathname();

  const tabs: TabItem[] = [
    {
      href: "/",
      label: "ホーム",
      icon: Home,
      isActive: (path) => path === "/",
    },
    {
      href: "/search",
      label: "検索",
      icon: Sparkles,
      isActive: (path) => path.startsWith("/search"),
      center: true,
    },
    {
      href: "/mypage",
      label: "マイページ",
      icon: User,
      isActive: (path) => path.startsWith("/mypage"),
      showBadge: showMypageBadge,
    },
  ];

  return (
    <nav
      aria-label="メインナビゲーション"
      className="shrink-0 border-t border-border bg-mogu-surface-elevated pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex h-mogu-tab-bar items-end justify-around px-mogu-screen-x">
        {tabs.map((tab) => {
          const active = tab.isActive(pathname);
          const Icon = tab.icon;

          if (tab.center) {
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                aria-label={tab.label}
                className="relative -top-2 flex flex-col items-center gap-1"
              >
                <span
                  className={cn(
                    "flex size-12 items-center justify-center rounded-full border border-border shadow-sm transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-mogu-surface-elevated text-foreground",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <span
                  className={cn(
                    "text-xs",
                    active ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {tab.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className="relative flex flex-1 flex-col items-center justify-end gap-1 pb-1"
            >
              <span className="relative flex size-8 items-center justify-center">
                <Icon
                  className={cn(
                    "size-5",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                  aria-hidden
                />
                {tab.showBadge ? (
                  <span
                    className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-mogu-badge"
                    aria-label="未読通知あり"
                  />
                ) : null}
              </span>
              <span
                className={cn(
                  "text-xs",
                  active ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
