"use client";

import { AuthImage } from "@/components/mypage/auth-image";
import { cn } from "@/lib/utils";

type CollectionCoverProps = {
  name: string;
  coverUrl: string | null;
  autoCoverUrls?: string[];
  className?: string;
  imageClassName?: string;
};

function collectionInitials(name: string): string {
  return name.trim().slice(0, 1) || "コ";
}

export function CollectionCover({
  name,
  coverUrl,
  autoCoverUrls = [],
  className,
  imageClassName,
}: CollectionCoverProps) {
  const urls = coverUrl ? [coverUrl] : autoCoverUrls;

  if (urls.length === 0) {
    return (
      <div
        className={cn(
          "flex size-full items-center justify-center bg-gradient-to-br from-muted to-background",
          className,
        )}
      >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground">
          {collectionInitials(name)}
        </span>
      </div>
    );
  }

  if (urls.length === 1) {
    return (
      <AuthImage
        objectUrl={urls[0]!}
        alt=""
        className={cn("size-full object-cover", className, imageClassName)}
      />
    );
  }

  const mosaic = urls.slice(0, 4);
  return (
    <div className={cn("grid size-full grid-cols-2 grid-rows-2 gap-px bg-border", className)}>
      {mosaic.map((url) => (
        <AuthImage
          key={url}
          objectUrl={url}
          alt=""
          className={cn("size-full object-cover", imageClassName)}
        />
      ))}
    </div>
  );
}
