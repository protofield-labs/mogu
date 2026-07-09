/**
 * Photo avatar (#259) verification.
 * Run via: pnpm exec tsx scripts/verify-avatar-url.ts
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
assert(schema.includes("avatarUrl"), "prisma User has avatarUrl");
assert(schema.includes('@map("avatar_url")'), "prisma maps avatar_url");

const migration = readFileSync(
  join(process.cwd(), "prisma/migrations/20260709140000_user_avatar_url/migration.sql"),
  "utf8",
);
assert(migration.includes("avatar_url"), "migration adds avatar_url");

const userSchema = readSource("lib/api/schemas/user.ts");
assert(userSchema.includes("avatarUrl"), "userSchema includes avatarUrl");

const profileSchema = readSource("lib/users/profile-schema.ts");
assert(profileSchema.includes("avatarUrl"), "profileBodySchema includes avatarUrl");

const patchHandler = readSource("lib/users/patch-profile-handler.ts");
assert(patchHandler.includes("validateOwnedPhotoUrl"), "PATCH validates owned avatarUrl");
assert(patchHandler.includes("Invalid avatarUrl"), "rejects foreign avatarUrl");

const usersDal = readSource("lib/dal/users.ts");
assert(usersDal.includes("avatarUrl: true"), "userSelect includes avatarUrl");
assert(usersDal.includes("avatarUrl"), "toUserDto / updateUserProfile handle avatarUrl");

const canView = readSource("lib/dal/spots.ts");
assert(canView.includes("avatarUrl: objectUrl"), "media proxy allows avatar photos");

const avatar = readSource("components/ui/avatar.tsx");
assert(avatar.includes("avatarUrl"), "Avatar accepts avatarUrl");
assert(avatar.includes("AuthImage"), "Avatar renders AuthImage for photos");

const accountSheet = readSource("components/mypage/mypage-account-sheet.tsx");
assert(accountSheet.includes("AvatarPhotoField"), "account settings expose photo picker");
assert(
  accountSheet.includes("avatarChanged"),
  "account save omits unchanged avatarUrl",
);

const photoField = readSource("components/mypage/avatar-photo-field.tsx");
assert(photoField.includes("uploadPhotoFile"), "photo field uploads via signed URL");

console.log("PASS: avatar url verified");
