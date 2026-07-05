/**
 * Photo URL validation (#35 Definition of Done).
 * Run via: pnpm exec tsx scripts/verify-photo-url.ts
 */
import {
  buildObjectPublicUrl,
  buildUploadObjectPath,
  extensionForContentType,
  isAllowedUploadContentType,
  parseUploadObjectPath,
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

  // Media proxy path parsing (traversal defense)
  const parsed = parseUploadObjectPath(["uploads", "user-abc", "photo-1.jpg"]);
  assert(parsed?.objectPath === "uploads/user-abc/photo-1.jpg", "valid path parsed");
  assert(parsed?.ownerUid === "user-abc", "owner uid extracted");
  assert(
    parseUploadObjectPath(["uploads", "user-abc", "..", "user-xyz", "x.jpg"]) === null,
    "traversal segments rejected (length)",
  );
  assert(
    parseUploadObjectPath(["uploads", "..", "secret.jpg"]) === null,
    "dot-dot owner rejected",
  );
  assert(
    parseUploadObjectPath(["uploads", "user-abc", "..%2fescape.jpg"]) === null,
    "encoded traversal filename rejected",
  );
  assert(
    parseUploadObjectPath(["budget-slack-dedupe", "user-abc", "x.jpg"]) === null,
    "non-uploads root rejected",
  );
  assert(
    parseUploadObjectPath(["uploads", "user-abc", ".hidden"]) === null,
    "dotfile rejected",
  );

  console.log("PASS: photo URL validation verified");
}

main();
