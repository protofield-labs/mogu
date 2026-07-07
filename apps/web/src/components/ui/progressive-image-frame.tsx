"use client";

import { ImageOff } from "lucide-react";

import { cn } from "@/lib/utils";

export type ProgressiveImageStatus = "loading" | "loaded" | "error";

type ProgressiveImageFrameProps = {
  className?: string;
  status: ProgressiveImageStatus;
  alt: string;
  src: string | null;
  imageVisible: boolean;
  onImageLoad: () => void;
  onImageError: () => void;
};

export function ProgressiveImageFrame({
  className,
  status,
  alt,
  src,
  imageVisible,
  onImageLoad,
  onImageError,
}: ProgressiveImageFrameProps) {
  const showShimmer = status === "loading";
  const showError = status === "error";

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {showShimmer ? (
        <div className="mogu-shimmer absolute inset-0" aria-hidden />
      ) : null}
      {showError ? (
        <div
          className="absolute inset-0 flex items-center justify-center text-muted-foreground/55"
          role={alt ? "img" : undefined}
          aria-label={alt || undefined}
        >
          <ImageOff className="size-5" strokeWidth={1.5} aria-hidden />
          {alt ? <span className="sr-only">{alt}</span> : null}
        </div>
      ) : null}
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob URL from authenticated fetch
        <img
          src={src}
          alt={alt}
          onLoad={onImageLoad}
          onError={onImageError}
          className={cn(
            "size-full object-cover transition-opacity duration-300 motion-reduce:transition-none",
            imageVisible ? "opacity-100" : "opacity-0",
          )}
          loading="lazy"
          decoding="async"
        />
      ) : null}
    </div>
  );
}
