export class StorageNotConfiguredError extends Error {
  constructor() {
    super("GCS bucket is not configured (set GCS_BUCKET or GOOGLE_CLOUD_PROJECT)");
    this.name = "StorageNotConfiguredError";
  }
}

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const CONTENT_TYPE_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

/** Resolve app bucket (`{project_id}-{environment}-app` in dev Terraform). */
export function resolveBucketName(): string {
  const explicit = process.env.GCS_BUCKET?.trim();
  if (explicit) {
    return explicit;
  }

  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  if (project) {
    const environment = process.env.APP_ENV?.trim() || "dev";
    return `${project}-${environment}-app`;
  }

  throw new StorageNotConfiguredError();
}

export function isAllowedUploadContentType(contentType: string): boolean {
  return ALLOWED_CONTENT_TYPES.has(contentType.trim().toLowerCase());
}

export function extensionForContentType(contentType: string): string | null {
  return CONTENT_TYPE_EXTENSION[contentType.trim().toLowerCase()] ?? null;
}

export function buildUploadObjectPath(uid: string, extension: string): string {
  const safeUid = uid.replace(/[^a-zA-Z0-9_-]/g, "");
  const id = crypto.randomUUID();
  return `uploads/${safeUid}/${id}.${extension}`;
}

export function buildObjectPublicUrl(bucket: string, objectPath: string): string {
  return `https://storage.googleapis.com/${bucket}/${objectPath}`;
}

/** Accept only user-owned objects in the app bucket (#35 guardrail). */
export function validateOwnedPhotoUrl(
  url: string,
  uid: string,
  bucket: string,
): boolean {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:") {
      return false;
    }
    const expectedHost = "storage.googleapis.com";
    if (parsed.hostname !== expectedHost) {
      return false;
    }
    const prefix = `/${bucket}/uploads/${uid.replace(/[^a-zA-Z0-9_-]/g, "")}/`;
    return parsed.pathname.startsWith(prefix);
  } catch {
    return false;
  }
}

export function objectPathFromPublicUrl(
  url: string,
  bucket: string,
): string | null {
  try {
    const parsed = new URL(url.trim());
    const prefix = `/${bucket}/`;
    if (!parsed.pathname.startsWith(prefix)) {
      return null;
    }
    return parsed.pathname.slice(prefix.length);
  } catch {
    return null;
  }
}

export function validatePhotoUrls(urls: string[], uid: string, bucket: string): boolean {
  if (urls.length > 5) {
    return false;
  }
  return urls.every((url) => validateOwnedPhotoUrl(url, uid, bucket));
}
