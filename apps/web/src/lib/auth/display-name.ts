import type { User } from "firebase/auth";

/** Resolve display_name for provisioning (#17). */
export function resolveDisplayName(user: User, override?: string): string {
  const trimmedOverride = override?.trim();
  if (trimmedOverride) {
    return trimmedOverride;
  }

  const trimmedProfile = user.displayName?.trim();
  if (trimmedProfile) {
    return trimmedProfile;
  }

  const email = user.email;
  if (email) {
    const localPart = email.split("@")[0]?.trim();
    if (localPart) {
      return localPart;
    }
  }

  return "User";
}
