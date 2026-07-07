"use client";

import { spotPath, collectionPath, friendProfilePath } from "@/lib/share/paths";

export function buildShareUrl(path: string): string {
  if (typeof window === "undefined") {
    return path;
  }
  return new URL(path, window.location.origin).toString();
}

export function spotShareUrl(spotId: string): string {
  return buildShareUrl(spotPath(spotId));
}

export function collectionShareUrl(collectionId: string): string {
  return buildShareUrl(collectionPath(collectionId));
}

export function profileShareUrl(userId: string): string {
  return buildShareUrl(friendProfilePath(userId));
}
