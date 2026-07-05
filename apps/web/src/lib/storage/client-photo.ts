"use client";

/** Map a stored GCS URL to the authenticated media proxy path. */
export function toMediaProxyPath(objectUrl: string): string {
  try {
    const parsed = new URL(objectUrl);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
      return objectUrl;
    }
    const objectPath = segments.slice(1).join("/");
    return `/api/v1/media/${objectPath}`;
  } catch {
    return objectUrl;
  }
}
