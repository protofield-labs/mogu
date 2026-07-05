"use client";

import { useEffect, useState } from "react";

import { authFetch } from "@/lib/auth/auth-fetch";
import { toMediaProxyPath } from "@/lib/storage/client-photo";

type AuthImageProps = {
  objectUrl: string;
  alt: string;
  className?: string;
};

type LoadedImage = {
  forUrl: string;
  src: string;
};

export function AuthImage({ objectUrl, alt, className }: AuthImageProps) {
  const [loaded, setLoaded] = useState<LoadedImage | null>(null);

  useEffect(() => {
    let cancelled = false;
    let blobUrl: string | null = null;

    async function load() {
      try {
        const response = await authFetch(toMediaProxyPath(objectUrl));
        if (!response.ok) {
          if (!cancelled) {
            setLoaded(null);
          }
          return;
        }
        const blob = await response.blob();
        if (cancelled) {
          return;
        }
        blobUrl = URL.createObjectURL(blob);
        setLoaded({ forUrl: objectUrl, src: blobUrl });
      } catch {
        if (!cancelled) {
          setLoaded(null);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [objectUrl]);

  // Only render a blob that belongs to the current objectUrl (no stale image).
  const src = loaded && loaded.forUrl === objectUrl ? loaded.src : null;

  if (!src) {
    return <div className={className} aria-hidden />;
  }

  // eslint-disable-next-line @next/next/no-img-element -- blob URL from authenticated fetch
  return <img src={src} alt={alt} className={className} />;
}
