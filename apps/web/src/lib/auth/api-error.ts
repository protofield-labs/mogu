/** OpenAPI ErrorBody (`docs/openapi.yaml` components.schemas.ErrorBody). */
export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation"
  | "internal";

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
  };
};

export function apiErrorResponse(
  code: ApiErrorCode,
  message: string,
  status: number,
): Response {
  const body: ApiErrorBody = { error: { code, message } };
  return Response.json(body, { status });
}

export function unauthorizedResponse(
  message = "Unauthorized",
): Response {
  return apiErrorResponse("unauthorized", message, 401);
}

export function forbiddenResponse(message = "Forbidden"): Response {
  return apiErrorResponse("forbidden", message, 403);
}

export function notFoundResponse(message = "Not found"): Response {
  return apiErrorResponse("not_found", message, 404);
}

export function conflictResponse(message = "Conflict"): Response {
  return apiErrorResponse("conflict", message, 409);
}

export function validationErrorResponse(message: string): Response {
  return apiErrorResponse("validation", message, 400);
}

export function internalServerErrorResponse(
  message = "Internal server error",
): Response {
  return apiErrorResponse("internal", message, 500);
}

/** Parse JSON body for tests and client error handling. */
export async function parseApiErrorBody(
  response: Response,
): Promise<ApiErrorBody | null> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as ApiErrorBody).error?.code === "string" &&
      typeof (body as ApiErrorBody).error?.message === "string"
    ) {
      return body as ApiErrorBody;
    }
    return null;
  } catch {
    return null;
  }
}
