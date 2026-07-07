"use client";

import { useCallback } from "react";

import { ProgressiveImageFrame } from "@/components/ui/progressive-image-frame";
import { authFetch } from "@/lib/auth/auth-fetch";
import { useAuthenticatedImageBlob } from "@/lib/ui/use-authenticated-image-blob";

type PlacePhotoImageProps = {
  url: string;
  alt?: string;
  className?: string;
};

/** Place Photos proxy image via authenticated fetch (guardrail 7). */
export function PlacePhotoImage({
  url,
  alt = "",
  className,
}: PlacePhotoImageProps) {
  const fetchPhoto = useCallback((key: string) => authFetch(key), []);
  const { status, src, imageVisible, onImageLoad, onImageError } =
    useAuthenticatedImageBlob(url, fetchPhoto);

  return (
    <ProgressiveImageFrame
      className={className}
      status={status}
      alt={alt}
      src={src}
      imageVisible={imageVisible}
      onImageLoad={onImageLoad}
      onImageError={onImageError}
    />
  );
}
