"use client";

import { useCallback } from "react";

import { ProgressiveImageFrame } from "@/components/ui/progressive-image-frame";
import { authFetch } from "@/lib/auth/auth-fetch";
import { toMediaProxyPath } from "@/lib/storage/client-photo";
import { useAuthenticatedImageBlob } from "@/lib/ui/use-authenticated-image-blob";

type AuthImageProps = {
  objectUrl: string;
  alt: string;
  className?: string;
};

export function AuthImage({ objectUrl, alt, className }: AuthImageProps) {
  const fetchObject = useCallback(
    (key: string) => authFetch(toMediaProxyPath(key)),
    [],
  );
  const { status, src, imageVisible, onImageLoad, onImageError } =
    useAuthenticatedImageBlob(objectUrl, fetchObject);

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
