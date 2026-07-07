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

    const timer = window.setTimeout(() => {
      const mapDiv = map.getDiv();
      const hasErrorOverlay = mapDiv.querySelector(GMP_ERROR_SELECTOR);
      const hasRenderedCanvas = mapDiv.querySelector("canvas") !== null;
      if (!hasErrorOverlay && !hasRenderedCanvas) {
        reportOnce(reportedRef, onLoadError, "tilesTimeout");
      }
    }, TILES_LOAD_TIMEOUT_MS);

    return () => {
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
