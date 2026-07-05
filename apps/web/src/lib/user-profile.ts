export const DEFAULT_AVATAR_COLOR = "#888888";

export const ONBOARDING_AVATAR_COLORS = [
  "#D97706",
  "#DC2626",
  "#DB2777",
  "#7C3AED",
  "#2563EB",
  "#0891B2",
  "#059669",
  "#65A30D",
] as const;

export function isOnboardingComplete(user: {
  displayName: string;
  avatarColor: string;
}): boolean {
  return user.displayName.trim().length > 0 && user.avatarColor !== DEFAULT_AVATAR_COLOR;
}
