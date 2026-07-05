/**
 * Photo URL validation (#35 Definition of Done).
 * Run via: pnpm exec tsx scripts/verify-photo-url.ts
 */
import {
  buildObjectPublicUrl,
  buildUploadObjectPath,
  extensionForContentType,
  isAllowedUploadContentType,
  validateOwnedPhotoUrl,
  validatePhotoUrls,
} from "../src/lib/storage/photo-url";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  const bucket = "mogu-501309-dev-app";
  const uid = "user-abc";
  const objectPath = buildUploadObjectPath(uid, "jpg");
  const objectUrl = buildObjectPublicUrl(bucket, objectPath);

  assert(isAllowedUploadContentType("image/jpeg"), "jpeg allowed");
  assert(!isAllowedUploadContentType("text/plain"), "text/plain rejected");
  assert(extensionForContentType("image/png") === "png", "png extension");

  assert(validateOwnedPhotoUrl(objectUrl, uid, bucket), "owned url valid");
  assert(
    !validateOwnedPhotoUrl(objectUrl, "other-user", bucket),
    "other user rejected",
  );
  assert(
    !validateOwnedPhotoUrl("https://evil.example/uploads/user-abc/x.jpg", uid, bucket),
    "foreign host rejected",
  );
  assert(validatePhotoUrls([objectUrl], uid, bucket), "photoUrls array valid");
  assert(!validatePhotoUrls(Array.from({ length: 6 }, () => objectUrl), uid, bucket), "max 5");

  console.log("PASS: photo URL validation verified");
}

main();
