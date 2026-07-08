"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home } from "lucide-react";

import { MoguBrandIcon } from "@/components/brand/mogu-brand-icon";
import { Avatar } from "@/components/ui/avatar";
import { useMeBadges } from "@/lib/mypage/use-me-badges";
import { touchIconClass } from "@/lib/ui/touch-feedback";
import { cn } from "@/lib/utils";

type TabItem = {
  href: string;
  label: string;
  icon: typeof Home | "mogu" | "avatar";
  isActive: (pathname: string) => boolean;
  showBadge?: boolean;
};

function TabIcon({
  tab,
  active,
  tabProfile,
}: {
  tab: TabItem;
  active: boolean;
  tabProfile: { displayName: string; avatarColor: string } | null;
}) {
  if (tab.icon === "avatar") {
    if (tabProfile) {
      return (
        <Avatar
          displayName={tabProfile.displayName}
          avatarColor={tabProfile.avatarColor}
          size="tab"
          className={cn(
            "ring-2 ring-offset-2 ring-offset-background",
            active ? "ring-primary" : "ring-transparent",
          )}
        />
      );
    }
    return (
      <span
        className={cn(
          "flex size-7 items-center justify-center rounded-full bg-muted text-[0.625rem] font-semibold text-muted-foreground",
          active && "text-primary",
        )}
        aria-hidden
      >
        ?
      </span>
    );
  }

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

export function TabBar() {
  const pathname = usePathname();
  const { showBadge, tabProfile } = useMeBadges();

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
      icon: "avatar",
      isActive: (path) => path.startsWith("/mypage"),
      showBadge: showBadge,
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
                <TabIcon tab={tab} active={active} tabProfile={tabProfile} />
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
