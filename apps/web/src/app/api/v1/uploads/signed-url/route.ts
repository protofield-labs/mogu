import {
  apiErrorResponse,
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import { signedUploadBodySchema } from "@/lib/api/schemas/uploads";
import {
  createSignedUploadUrl,
  StorageNotConfiguredError,
} from "@/lib/storage/gcs-client";

export async function POST(request: Request): Promise<Response> {
  return withAuthRoute(request, async (req, { uid }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return validationErrorResponse("Invalid JSON");
    }

    const parsed = signedUploadBodySchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse("Invalid request body");
    }

    try {
      const result = await createSignedUploadUrl(uid, parsed.data.contentType);
      return Response.json(result);
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
