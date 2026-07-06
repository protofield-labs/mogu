"use client";

import { cn } from "@/lib/utils";

type UserAvatarProps = {
  displayName: string;
  avatarColor: string;
  size?: "md" | "lg";
  showNewRing?: boolean;
  className?: string;
};

export function UserAvatar({
  displayName,
  avatarColor,
  size = "md",
  showNewRing = false,
  className,
}: UserAvatarProps) {
  const sizeClass = size === "lg" ? "size-14 text-base" : "size-11 text-sm";

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        sizeClass,
        showNewRing
          ? "ring-2 ring-mogu-avatar-ring-new ring-offset-2 ring-offset-background"
          : "ring-1 ring-mogu-avatar-ring-idle",
        className,
      )}
      style={{ backgroundColor: avatarColor }}
      aria-hidden
    >
      {displayName.slice(0, 1)}
    </span>
  );
}
