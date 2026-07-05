import "server-only";

import { verifySession } from "./verify-session";
import { internalServerErrorResponse, unauthorizedResponse } from "./api-error";
import { logger } from "@/lib/logger";

export type AuthContext = {
  uid: string;
};

export type AuthenticatedHandler = (
  request: Request,
  auth: AuthContext,
) => Promise<Response>;

export {
  apiErrorResponse,
  conflictResponse,
  forbiddenResponse,
  internalServerErrorResponse,
  notFoundResponse,
  parseApiErrorBody,
  unauthorizedResponse,
  validationErrorResponse,
  type ApiErrorBody,
  type ApiErrorCode,
} from "./api-error";

/** Returns uid or a 401 Response for Route Handlers. */
export async function requireAuth(
  request: Request,
): Promise<AuthContext | Response> {
  const session = await verifySession(request);
  if (!session) {
    return unauthorizedResponse();
  }
  return session;
}

function requestLogContext(request: Request, uid?: string): {
  method: string;
  path: string;
  uid?: string;
} {
  const { pathname } = new URL(request.url);
  return {
    method: request.method,
    path: pathname,
    ...(uid ? { uid } : {}),
  };
}

/**
 * Route Handler wrapper (#29): Bearer verify → uid → handler.
 * Uncaught errors are logged and returned as 500 ErrorBody (no stack leak).
 */
export async function withAuthRoute(
  request: Request,
  handler: AuthenticatedHandler,
): Promise<Response> {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  try {
    return await handler(request, auth);
  } catch (error) {
    logger.error(
      "Unhandled route handler error",
      requestLogContext(request, auth.uid),
      error,
    );
    return internalServerErrorResponse();
  }
}
