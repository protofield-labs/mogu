"use client";

import { useEffect, useState } from "react";

import { authFetch } from "@/lib/auth/auth-fetch";
import { toMediaProxyPath } from "@/lib/storage/client-photo";

type AuthImageProps = {
  objectUrl: string;
  alt: string;
  className?: string;
};

export function AuthImage({ objectUrl, alt, className }: AuthImageProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrlToRevoke: string | null = null;

    async function load() {
      try {
        const response = await authFetch(toMediaProxyPath(objectUrl));
        if (!response.ok) {
          return;
        }
        const blob = await response.blob();
        if (cancelled) {
          return;
        }
        objectUrlToRevoke = URL.createObjectURL(blob);
        setSrc(objectUrlToRevoke);
      } catch {
        if (!cancelled) {
          setSrc(null);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
    };
  }, [objectUrl]);

  if (!src) {
    return (
      <div
        className={className}
        aria-hidden
      />
    );
  }

  // eslint-disable-next-line @next/next/no-img-element -- blob URL from authenticated fetch
  return <img src={src} alt={alt} className={className} />;
}
