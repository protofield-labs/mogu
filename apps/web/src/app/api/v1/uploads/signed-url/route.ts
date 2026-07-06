import { parseJsonBody } from "@/lib/api/parse-json-body";
import { signedUploadBodySchema } from "@/lib/api/schemas/uploads";
import {
  apiErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import {
  createSignedUploadUrl,
  StorageNotConfiguredError,
} from "@/lib/storage/gcs-client";

export async function POST(request: Request): Promise<Response> {
  return withAuthRoute(request, async (req, { uid }) => {
    const parsed = await parseJsonBody(req, signedUploadBodySchema);
    if (!parsed.ok) {
      return parsed.response;
    }

    try {
      const signed = await createSignedUploadUrl(uid, parsed.data.contentType);
      return Response.json(signed);
    } catch (error) {
      if (error instanceof StorageNotConfiguredError) {
        return apiErrorResponse("internal", error.message, 503);
      }
      throw error;
    }
  });
}
