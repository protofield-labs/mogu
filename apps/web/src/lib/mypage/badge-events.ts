"use client";

/** Fired after an action that changes badge counts (flags read, request accepted). */
export const BADGES_UPDATED_EVENT = "mogu:badges-updated";

/** Fired after profile display name / avatar color changes (#101 tab avatar). */
export const PROFILE_UPDATED_EVENT = "mogu:profile-updated";

export function notifyBadgesUpdated(): void {
  window.dispatchEvent(new Event(BADGES_UPDATED_EVENT));
}

export function notifyProfileUpdated(): void {
  window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
}
