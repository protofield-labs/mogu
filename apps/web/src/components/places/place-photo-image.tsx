"use client";

import { useEffect, useState } from "react";

import { authFetch } from "@/lib/auth/auth-fetch";

type PlacePhotoImageProps = {
  url: string;
  alt?: string;
  className?: string;
};

type LoadedImage = {
  forUrl: string;
  src: string;
};

/** Place Photos proxy image via authenticated fetch (guardrail 7). */
export function PlacePhotoImage({
  url,
  alt = "",
  className,
}: PlacePhotoImageProps) {
  const [loaded, setLoaded] = useState<LoadedImage | null>(null);

  useEffect(() => {
    let cancelled = false;
    let blobUrl: string | null = null;

    async function load() {
      try {
        const response = await authFetch(url);
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
        setLoaded({ forUrl: url, src: blobUrl });
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
  }, [url]);

  const src = loaded && loaded.forUrl === url ? loaded.src : null;

  if (!src) {
    return <div className={className} aria-hidden />;
  }

  // eslint-disable-next-line @next/next/no-img-element -- blob URL from authenticated fetch
  return <img src={src} alt={alt} className={className} loading="lazy" decoding="async" />;
}
