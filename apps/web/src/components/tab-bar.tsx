"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, User } from "lucide-react";

import { MoguTabIcon } from "@/components/brand/mogu-brand-icon";
import { useMeBadges } from "@/lib/mypage/use-me-badges";
import { touchIconClass } from "@/lib/ui/touch-feedback";
import { cn } from "@/lib/utils";

type TabItem = {
  href: string;
  label: string;
  icon: typeof Home | typeof User | "mogu";
  isActive: (pathname: string) => boolean;
  showBadge?: boolean;
};

function TabIcon({ tab, active }: { tab: TabItem; active: boolean }) {
  const className = cn(
    "size-6 transition-colors transition-transform",
    active ? "text-primary" : "text-muted-foreground",
  );

  if (tab.icon === "mogu") {
    return <MoguTabIcon className={className} />;
  }

  const Icon = tab.icon;
  return <Icon className={className} aria-hidden />;
}

export function TabBar() {
  const pathname = usePathname();
  const { showBadge } = useMeBadges();

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
      showBadge: showBadge,
    },
  ];

  return (
    <nav
      aria-label="メインナビゲーション"
      className="shrink-0 border-t border-border bg-mogu-surface-elevated pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex h-mogu-tab-bar items-center justify-around px-mogu-screen-x pt-1">
        {tabs.map((tab) => {
          const active = tab.isActive(pathname);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className="relative flex flex-1 flex-col items-center justify-center gap-0.5"
            >
              <span
                className={cn(
                  "relative flex size-9 items-center justify-center",
                  touchIconClass,
                )}
              >
                <TabIcon tab={tab} active={active} />
                {tab.showBadge ? (
                  <span
                    className="absolute right-0.5 top-0.5 size-2 rounded-full bg-mogu-badge"
                    aria-label="未読通知あり"
                  />
                ) : null}
              </span>
              <span
                className={cn(
                  "text-[0.625rem] font-medium leading-none",
                  active ? "text-primary" : "text-muted-foreground",
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
