"use client";

import {
  APIProvider,
  APILoadingStatus,
  Map,
  useApiLoadingStatus,
  useMap,
  type MapProps,
} from "@vis.gl/react-google-maps";
import {
  useCallback,
  useEffect,
  useRef,
  type PropsWithChildren,
  type RefObject,
} from "react";

import {
  mapsLoadErrorMessage,
  type MapsLoadFailureKind,
} from "@/lib/places/maps-load-error";

const TILES_LOAD_TIMEOUT_MS = 12_000;
const GMP_ERROR_SELECTOR = ".gmp-error, .gm-err-container, .gm-err-message";
const MAPS_REFERRER_ERROR_PATTERN = /RefererNotAllowedMapError|RefererNotAllowed/i;

/** Raster basemap tiles render as <img> inside .gm-style, not always as <canvas> (#224). */
function hasRenderedMapTiles(mapDiv: HTMLElement): boolean {
  if (mapDiv.querySelector("canvas") !== null) {
    return true;
  }
  const styleRoot = mapDiv.querySelector(".gm-style");
  if (!styleRoot) {
    return false;
  }
  return [...styleRoot.querySelectorAll("img")].some((img) => {
    const src = img.getAttribute("src") ?? "";
    return (
      src.includes("maps.googleapis.com/maps/vt") ||
      src.includes("googleusercontent.com/vt")
    );
  });
}

type MapApiProviderProps = PropsWithChildren<{
  apiKey: string;
  onLoadError: (message: string) => void;
}>;

function reportOnce(
  reportedRef: RefObject<boolean>,
  onLoadError: (message: string) => void,
  kind: MapsLoadFailureKind,
) {
  if (reportedRef.current) {
    return;
  }
  reportedRef.current = true;
  onLoadError(mapsLoadErrorMessage(kind));
}

function MapApiStatusWatcher({
  containerRef,
  onLoadError,
  reportedRef,
  children,
}: PropsWithChildren<{
  containerRef: RefObject<HTMLDivElement | null>;
  onLoadError: (message: string) => void;
  reportedRef: RefObject<boolean>;
}>) {
  const status = useApiLoadingStatus();

  useEffect(() => {
    if (status === APILoadingStatus.FAILED) {
      reportOnce(reportedRef, onLoadError, "scriptLoad");
    } else if (status === APILoadingStatus.AUTH_FAILURE) {
      reportOnce(reportedRef, onLoadError, "authFailure");
    }
  }, [status, onLoadError, reportedRef]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) {
      return;
    }

    function inspectDom() {
      const node = containerRef.current;
      if (!node) {
        return;
      }
      const overlay = node.querySelector(GMP_ERROR_SELECTOR);
      if (overlay?.textContent?.trim()) {
        reportOnce(reportedRef, onLoadError, "authFailure");
      }
    }

    const observer = new MutationObserver(inspectDom);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    inspectDom();
    return () => observer.disconnect();
  }, [containerRef, onLoadError, reportedRef]);

  if (
    status === APILoadingStatus.FAILED ||
    status === APILoadingStatus.AUTH_FAILURE
  ) {
    return null;
  }

  return children;
}

function MapTilesLoadedWatcher({
  onLoadError,
  reportedRef,
}: {
  onLoadError: (message: string) => void;
  reportedRef: RefObject<boolean>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) {
      return;
    }

    let tilesLoaded = false;
    const tilesListener = map.addListener("tilesloaded", () => {
      tilesLoaded = true;
    });

    const timer = window.setTimeout(() => {
      const mapDiv = map.getDiv();
      const hasErrorOverlay = mapDiv.querySelector(GMP_ERROR_SELECTOR);

      if (hasErrorOverlay) {
        reportOnce(reportedRef, onLoadError, "authFailure");
        return;
      }
      if (!tilesLoaded && !hasRenderedMapTiles(mapDiv)) {
        reportOnce(reportedRef, onLoadError, "tilesTimeout");
      }
    }, TILES_LOAD_TIMEOUT_MS);

    return () => {
      tilesListener.remove();
      window.clearTimeout(timer);
    };
  }, [map, onLoadError, reportedRef]);

  return null;
}

export function MapApiProvider({
  apiKey,
  onLoadError,
  children,
}: MapApiProviderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reportedRef = useRef(false);

  const handleScriptError = useCallback(() => {
    reportOnce(reportedRef, onLoadError, "scriptLoad");
  }, [onLoadError]);

  useEffect(() => {
    function handleWindowError(event: ErrorEvent) {
      const text = `${event.message ?? ""} ${event.error?.message ?? ""}`;
      if (MAPS_REFERRER_ERROR_PATTERN.test(text)) {
        reportOnce(reportedRef, onLoadError, "authFailure");
      }
    }

    window.addEventListener("error", handleWindowError);
    return () => window.removeEventListener("error", handleWindowError);
  }, [onLoadError]);

  return (
    <div ref={containerRef} className="contents">
      <APIProvider
        apiKey={apiKey}
        language="ja"
        region="JP"
        onError={handleScriptError}
      >
        <MapApiStatusWatcher
          containerRef={containerRef}
          onLoadError={onLoadError}
          reportedRef={reportedRef}
        >
          {children}
        </MapApiStatusWatcher>
      </APIProvider>
    </div>
  );
}

type MonitoredMapProps = MapProps & {
  onLoadError: (message: string) => void;
};

/** Map with tile-load timeout monitoring (must be inside MapApiProvider). */
export function MonitoredMap({ onLoadError, children, ...mapProps }: MonitoredMapProps) {
  const reportedRef = useRef(false);

  return (
    <Map {...mapProps}>
      <MapTilesLoadedWatcher onLoadError={onLoadError} reportedRef={reportedRef} />
      {children}
    </Map>
  );
}
