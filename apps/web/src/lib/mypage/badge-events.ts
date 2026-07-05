"use client";

/** Fired after an action that changes badge counts (flags read, request accepted). */
export const BADGES_UPDATED_EVENT = "mogu:badges-updated";

export function notifyBadgesUpdated(): void {
  window.dispatchEvent(new Event(BADGES_UPDATED_EVENT));
}
