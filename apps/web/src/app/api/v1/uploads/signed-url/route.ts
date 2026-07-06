import { parseJsonBody } from "@/lib/api/parse-json-body";
import { signedUploadBodySchema } from "@/lib/api/schemas/uploads";
import {
  apiErrorResponse,
  validationErrorResponse,
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
      if (error instanceof Error && error.message === "Unsupported content type") {
        return validationErrorResponse("Unsupported content type");
      }
      throw error;
    }
  });
}
