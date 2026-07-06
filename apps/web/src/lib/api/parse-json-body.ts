import "server-only";

import type { z } from "zod";

import { validationErrorResponse } from "@/lib/auth/require-auth";

type ParseJsonBodyResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: Response };

/** Parse JSON request body and validate with a Zod schema. */
export async function parseJsonBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<ParseJsonBodyResult<z.infer<T>>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, response: validationErrorResponse("Invalid JSON") };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, response: validationErrorResponse("Invalid request body") };
  }

  return { ok: true, data: parsed.data };
}

/** Like parseJsonBody but treats an empty body as `{}` (flags/read). */
export async function parseJsonBodyOrEmpty<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<ParseJsonBodyResult<z.infer<T>>> {
  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.trim().length > 0) {
      body = JSON.parse(text);
    }
  } catch {
    return { ok: false, response: validationErrorResponse("Invalid JSON") };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, response: validationErrorResponse("Invalid request body") };
  }

  return { ok: true, data: parsed.data };
}

/** Parse URL search params with a Zod object schema. */
export function parseSearchParams<T extends z.ZodType>(
  url: string | URL,
  schema: T,
): ParseJsonBodyResult<z.infer<T>> {
  const { searchParams } = new URL(url);
  const raw = Object.fromEntries(searchParams.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, response: validationErrorResponse("Invalid query parameters") };
  }
  return { ok: true, data: parsed.data };
}

/** Parse dynamic route params (Next.js App Router). */
export async function parseRouteParams<T extends z.ZodType>(
  params: Promise<Record<string, string>>,
  schema: T,
): Promise<ParseJsonBodyResult<z.infer<T>>> {
  const parsed = schema.safeParse(await params);
  if (!parsed.success) {
    return { ok: false, response: validationErrorResponse("Invalid route parameters") };
  }
  return { ok: true, data: parsed.data };
}
