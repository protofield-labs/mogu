"use client";

import { apiJson } from "@/lib/api/browser-client";
import { signedUploadResponseSchema } from "@/lib/api/schemas/uploads";
import { z } from "zod";

export type SignedUploadResponse = z.infer<typeof signedUploadResponseSchema>;

export async function requestSignedUploadUrl(
  contentType: string,
): Promise<SignedUploadResponse> {
  return apiJson(
    "/api/v1/uploads/signed-url",
    signedUploadResponseSchema,
    "アップロード URL を取得できませんでした",
    {
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType }),
      },
    },
  );
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
