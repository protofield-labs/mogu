import {
  apiErrorResponse,
  forbiddenResponse,
  notFoundResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import { readObjectStream, StorageNotConfiguredError } from "@/lib/storage/gcs-client";
import { objectPathFromPublicUrl, resolveBucketName } from "@/lib/storage/photo-url";

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

  const objectPath = segments.join("/");
  const expectedPrefix = "uploads/";

  return withAuthRoute(request, async (_req, { uid }) => {
    const safeUid = uid.replace(/[^a-zA-Z0-9_-]/g, "");
    if (!objectPath.startsWith(`${expectedPrefix}${safeUid}/`)) {
      return forbiddenResponse("Cannot access this object");
    }

    try {
      const bucket = resolveBucketName();
      const normalizedPath = objectPathFromPublicUrl(
        `https://storage.googleapis.com/${bucket}/${objectPath}`,
        bucket,
      );
      if (!normalizedPath) {
        return notFoundResponse("Object not found");
      }

      const { stream, contentType } = await readObjectStream(normalizedPath);
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
