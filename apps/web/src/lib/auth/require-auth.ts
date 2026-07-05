import "server-only";

import { verifySession } from "./verify-session";
import { unauthorizedResponse } from "./api-error";

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

/**
 * Route Handler wrapper (#29): Bearer verify → uid → handler.
 * DAL calls `withAuthRls(uid, fn)` inside the handler for RLS-scoped queries.
 */
export async function withAuthRoute(
  request: Request,
  handler: AuthenticatedHandler,
): Promise<Response> {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }
  return handler(request, auth);
}
