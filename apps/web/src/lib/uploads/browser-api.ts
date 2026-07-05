"use client";

import { parseApiErrorBody } from "@/lib/auth/api-error";
import { authFetch } from "@/lib/auth/auth-fetch";

export type SignedUploadResponse = {
  uploadUrl: string;
  objectUrl: string;
  objectPath: string;
  contentType: string;
};

async function readApiError(response: Response, fallback: string): Promise<Error> {
  const body = await parseApiErrorBody(response);
  return new Error(body?.error.message ?? fallback);
}

export async function requestSignedUploadUrl(
  contentType: string,
): Promise<SignedUploadResponse> {
  const response = await authFetch("/api/v1/uploads/signed-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType }),
  });
  if (!response.ok) {
    throw await readApiError(response, "アップロード URL を取得できませんでした");
  }
  return (await response.json()) as SignedUploadResponse;
}

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

/** Some browsers report an empty file.type for HEIC/HEIF; fall back to extension. */
function inferContentType(file: File): string | null {
  if (file.type) {
    return file.type;
  }
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_CONTENT_TYPES[extension] ?? null;
}

export async function uploadPhotoFile(file: File): Promise<string> {
  const contentType = inferContentType(file);
  if (!contentType) {
    throw new Error("対応していない画像形式です");
  }
  const signed = await requestSignedUploadUrl(contentType);
  const uploadResponse = await fetch(signed.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": signed.contentType },
    body: file,
  });
  if (!uploadResponse.ok) {
    throw new Error("写真のアップロードに失敗しました");
  }
  return signed.objectUrl;
}
