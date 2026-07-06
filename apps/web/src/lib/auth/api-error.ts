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

const API_ERROR_CODE_MESSAGES: Record<ApiErrorCode, string> = {
  unauthorized: "ログインが必要です",
  forbidden: "この操作は許可されていません",
  not_found: "対象が見つかりません",
  conflict: "操作できませんでした。内容を確認してください",
  validation: "入力内容に問題があります",
  internal: "サーバーエラーが発生しました。時間をおいて再度お試しください",
};

/** Known server messages mapped to Japanese (API still returns English). */
const API_ERROR_DETAIL_MESSAGES: Record<string, string> = {
  "Invalid request body": "入力内容に問題があります",
  "Invalid JSON": "入力内容に問題があります",
  "Cannot send a friend request to yourself": "自分自身には申請できません",
  "Friend request already exists": "すでに申請済みです",
  "Friend request is not pending": "この申請はすでに処理済みです",
  "User not found": "ユーザーが見つかりません",
  "Agent Engine is not configured":
    "エージェントが準備中です。しばらくしてから再度お試しください",
};

/** Map OpenAPI ErrorBody to user-facing Japanese (#89). */
export function formatApiErrorMessage(
  body: ApiErrorBody | null,
  fallback: string,
): string {
  if (!body) {
    return fallback;
  }

  const { code, message } = body.error;
  const detail = API_ERROR_DETAIL_MESSAGES[message];
  if (detail) {
    return detail;
  }

  return API_ERROR_CODE_MESSAGES[code] ?? fallback;
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

/** Build a localized Error from a failed API response. */
export async function readApiErrorResponse(
  response: Response,
  fallback: string,
): Promise<Error> {
  const body = await parseApiErrorBody(response);
  return new Error(formatApiErrorMessage(body, fallback));
}
