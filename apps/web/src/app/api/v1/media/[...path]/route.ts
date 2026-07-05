import {
  apiErrorResponse,
  forbiddenResponse,
  notFoundResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import { canViewPhotoUrl } from "@/lib/dal/spots";
import { readObjectStream, StorageNotConfiguredError } from "@/lib/storage/gcs-client";
import {
  buildObjectPublicUrl,
  parseUploadObjectPath,
  resolveBucketName,
} from "@/lib/storage/photo-url";

type RouteParams = {
  params: Promise<{ path: string[] }>;
};

export async function GET(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  const segments = (await params).path;
  if (!segments || segments.length === 0) {
    return notFoundResponse("Object not found");
  }

  // Strict parse rejects traversal and dot segments before any prefix check.
  const parsed = parseUploadObjectPath(segments);
  if (!parsed) {
    return notFoundResponse("Object not found");
  }

  return withAuthRoute(request, async (_req, { uid }) => {
    try {
      const bucket = resolveBucketName();
      const safeUid = uid.replace(/[^a-zA-Z0-9_-]/g, "");
      const isOwn = parsed.ownerUid === safeUid;

      if (!isOwn) {
        // Friend photos: allow only objects referenced by an RLS-visible
        // spot/collection (mirrors spots_select visibility).
        const objectUrl = buildObjectPublicUrl(bucket, parsed.objectPath);
        const visible = await canViewPhotoUrl(uid, objectUrl);
        if (!visible) {
          return forbiddenResponse("Cannot access this object");
        }
      }

      const { stream, contentType } = await readObjectStream(parsed.objectPath);
      return new Response(stream as unknown as BodyInit, {
        headers: {
          ...(contentType ? { "Content-Type": contentType } : {}),
          "Cache-Control": "private, max-age=3600",
        },
      });
    } catch (error) {
      if (error instanceof StorageNotConfiguredError) {
        return apiErrorResponse("internal", error.message, 503);
      }
      return notFoundResponse("Object not found");
    }
  });
}
