"use client";

import { AuthImage } from "@/components/mypage/auth-image";
import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "size-10 text-sm",
  md: "size-11 text-sm",
  lg: "size-14 text-base",
  xl: "size-12 text-sm",
  hero: "size-24 text-3xl shadow-sm",
} as const;

export type AvatarSize = keyof typeof sizeClasses;

export type AvatarProps = {
  displayName: string;
  avatarColor: string;
  avatarUrl?: string | null;
  size?: AvatarSize;
  showNewRing?: boolean;
  showInitial?: boolean;
  className?: string;
};

export function Avatar({
  displayName,
  avatarColor,
  avatarUrl = null,
  size = "md",
  showNewRing = false,
  showInitial = true,
  className,
}: AvatarProps) {
  const hasPhoto = typeof avatarUrl === "string" && avatarUrl.length > 0;

  return (
    <span
      data-slot="avatar"
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white",
        sizeClasses[size],
        showNewRing
          ? "ring-2 ring-mogu-avatar-ring-new ring-offset-2 ring-offset-background motion-safe:mogu-avatar-ring-new-pulse"
          : size !== "hero" && "ring-1 ring-mogu-avatar-ring-idle",
        className,
      )}
      style={hasPhoto ? undefined : { backgroundColor: avatarColor }}
      aria-hidden
    >
      {hasPhoto ? (
        <AuthImage
          objectUrl={avatarUrl}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      ) : showInitial ? (
        displayName.slice(0, 1) || "?"
      ) : null}
    </span>
  );
}
