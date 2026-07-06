"use client";

import type { z } from "zod";

import { readApiErrorResponse } from "@/lib/auth/api-error";
import { authFetch } from "@/lib/auth/auth-fetch";

export class ApiResponseValidationError extends Error {
  constructor(message = "サーバーからの応答形式が不正です") {
    super(message);
    this.name = "ApiResponseValidationError";
  }
}

type ApiJsonOptions = {
  init?: RequestInit;
  /** HTTP statuses that resolve to null instead of parsing JSON. */
  emptyStatuses?: number[];
};

/** Parse and validate JSON from an existing Response. */
export async function parseApiJson<T extends z.ZodType>(
  response: Response,
  schema: T,
  fallback: string,
): Promise<z.infer<T>> {
  if (!response.ok) {
    throw await readApiErrorResponse(response, fallback);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiResponseValidationError();
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiResponseValidationError();
  }

  return parsed.data;
}

/** authFetch + JSON parse + Zod validation. */
export async function apiJson<T extends z.ZodType>(
  path: string,
  schema: T,
  fallback: string,
  options?: ApiJsonOptions,
): Promise<z.infer<T>> {
  const response = await authFetch(path, options?.init);
  return parseApiJson(response, schema, fallback);
}

/** Like apiJson but returns null for configured empty statuses (default 204). */
export async function apiJsonOrNull<T extends z.ZodType>(
  path: string,
  schema: T,
  fallback: string,
  options?: ApiJsonOptions,
): Promise<z.infer<T> | null> {
  const emptyStatuses = options?.emptyStatuses ?? [204];
  const response = await authFetch(path, options?.init);
  if (emptyStatuses.includes(response.status)) {
    return null;
  }
  return parseApiJson(response, schema, fallback);
}

/** authFetch expecting an empty success body (204 or 2xx without JSON). */
export async function apiVoid(
  path: string,
  fallback: string,
  init?: RequestInit,
): Promise<void> {
  const response = await authFetch(path, init);
  if (!response.ok) {
    throw await readApiErrorResponse(response, fallback);
  }
}
