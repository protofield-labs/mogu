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
  size?: AvatarSize;
  showNewRing?: boolean;
  showInitial?: boolean;
  className?: string;
};

export function Avatar({
  displayName,
  avatarColor,
  size = "md",
  showNewRing = false,
  showInitial = true,
  className,
}: AvatarProps) {
  return (
    <span
      data-slot="avatar"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        sizeClasses[size],
        showNewRing
          ? "ring-2 ring-mogu-avatar-ring-new ring-offset-2 ring-offset-background motion-safe:animate-pulse"
          : size !== "hero" && "ring-1 ring-mogu-avatar-ring-idle",
        className,
      )}
      style={{ backgroundColor: avatarColor }}
      aria-hidden
    >
      {showInitial ? displayName.slice(0, 1) || "?" : null}
    </span>
  );
}
