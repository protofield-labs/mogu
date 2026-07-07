"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, User } from "lucide-react";

import { MoguBrandIcon } from "@/components/brand/mogu-brand-icon";
import { touchIconClass } from "@/lib/ui/touch-feedback";
import { cn } from "@/lib/utils";

type TabBarProps = {
  showMypageBadge?: boolean;
};

type TabItem = {
  href: string;
  label: string;
  icon: typeof Home | typeof User | "mogu";
  isActive: (pathname: string) => boolean;
  showBadge?: boolean;
};

function TabIcon({ tab, active }: { tab: TabItem; active: boolean }) {
  const className = cn(
    "size-7 transition-colors transition-transform",
    active ? "text-primary" : "text-muted-foreground",
  );

  if (tab.icon === "mogu") {
    return <MoguBrandIcon className={className} />;
  }

  const Icon = tab.icon;
  return <Icon className={className} aria-hidden />;
}

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
      icon: "mogu",
      isActive: (path) => path.startsWith("/search"),
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
      <div className="flex h-mogu-tab-bar items-center justify-around px-mogu-screen-x">
        {tabs.map((tab) => {
          const active = tab.isActive(pathname);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              aria-label={tab.label}
              className="relative flex flex-1 items-center justify-center"
            >
              <span
                className={cn(
                  "relative flex size-11 items-center justify-center",
                  touchIconClass,
                )}
              >
                <TabIcon tab={tab} active={active} />
                {tab.showBadge ? (
                  <span
                    className="absolute right-1.5 top-1.5 size-2 rounded-full bg-mogu-badge"
                    aria-label="未読通知あり"
                  />
                ) : null}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
