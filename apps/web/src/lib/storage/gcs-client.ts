import "server-only";

import { Storage } from "@google-cloud/storage";

import {
  buildObjectPublicUrl,
  buildUploadObjectPath,
  extensionForContentType,
  isAllowedUploadContentType,
  resolveBucketName,
  StorageNotConfiguredError,
} from "@/lib/storage/photo-url";

let storageClient: Storage | null = null;

function getStorageClient(): Storage {
  if (!storageClient) {
    storageClient = new Storage();
  }
  return storageClient;
}

export type SignedUploadResult = {
  uploadUrl: string;
  objectUrl: string;
  objectPath: string;
  contentType: string;
};

export async function createSignedUploadUrl(
  uid: string,
  contentType: string,
): Promise<SignedUploadResult> {
  if (!isAllowedUploadContentType(contentType)) {
    throw new Error("Unsupported content type");
  }

  const extension = extensionForContentType(contentType);
  if (!extension) {
    throw new Error("Unsupported content type");
  }

  const bucketName = resolveBucketName();
  const objectPath = buildUploadObjectPath(uid, extension);
  const file = getStorageClient().bucket(bucketName).file(objectPath);

  const [uploadUrl] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 15 * 60 * 1000,
    contentType,
  });

  return {
    uploadUrl,
    objectUrl: buildObjectPublicUrl(bucketName, objectPath),
    objectPath,
    contentType,
  };
}

export async function readObjectStream(
  objectPath: string,
): Promise<{ stream: NodeJS.ReadableStream; contentType: string | null }> {
  const bucketName = resolveBucketName();
  const file = getStorageClient().bucket(bucketName).file(objectPath);
  const [metadata] = await file.getMetadata();
  const stream = file.createReadStream();
  const contentType =
    typeof metadata.contentType === "string" ? metadata.contentType : null;
  return { stream, contentType };
}

export { StorageNotConfiguredError };
