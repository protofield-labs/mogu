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

export async function uploadPhotoFile(file: File): Promise<string> {
  const signed = await requestSignedUploadUrl(file.type);
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
