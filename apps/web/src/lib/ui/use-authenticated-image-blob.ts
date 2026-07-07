"use client";

import { useEffect, useState } from "react";

import type { ProgressiveImageStatus } from "@/components/ui/progressive-image-frame";

type ImageBlobState = {
  forKey: string;
  status: ProgressiveImageStatus;
  src: string | null;
  imageVisible: boolean;
};

type AuthenticatedImageBlobState = {
  status: ProgressiveImageStatus;
  src: string | null;
  imageVisible: boolean;
  onImageLoad: () => void;
  onImageError: () => void;
};

function loadingState(forKey: string): ImageBlobState {
  return {
    forKey,
    status: "loading",
    src: null,
    imageVisible: false,
  };
}

/** Fetch a protected image as blob URL with loading / error state (#126). */
export function useAuthenticatedImageBlob(
  cacheKey: string,
  fetchResponse: (key: string) => Promise<Response>,
): AuthenticatedImageBlobState {
  const [state, setState] = useState<ImageBlobState>(() => loadingState(cacheKey));

  useEffect(() => {
    let cancelled = false;
    let blobUrl: string | null = null;

    async function load() {
      try {
        const response = await fetchResponse(cacheKey);
        if (!response.ok) {
          if (!cancelled) {
            setState({
              forKey: cacheKey,
              status: "error",
              src: null,
              imageVisible: false,
            });
          }
          return;
        }
        const blob = await response.blob();
        if (cancelled) {
          return;
        }
        blobUrl = URL.createObjectURL(blob);
        setState({
          forKey: cacheKey,
          status: "loading",
          src: blobUrl,
          imageVisible: false,
        });
      } catch {
        if (!cancelled) {
          setState({
            forKey: cacheKey,
            status: "error",
            src: null,
            imageVisible: false,
          });
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
  }, [cacheKey, fetchResponse]);

  const active =
    state.forKey === cacheKey ? state : loadingState(cacheKey);

  function onImageLoad() {
    setState((current) =>
      current.forKey !== cacheKey
        ? current
        : { ...current, status: "loaded", imageVisible: true },
    );
  }

  function onImageError() {
    setState((current) =>
      current.forKey !== cacheKey
        ? current
        : {
            forKey: cacheKey,
            status: "error",
            src: null,
            imageVisible: false,
          },
    );
  }

  return {
    status: active.status,
    src: active.src,
    imageVisible: active.imageVisible,
    onImageLoad,
    onImageError,
  };
}
