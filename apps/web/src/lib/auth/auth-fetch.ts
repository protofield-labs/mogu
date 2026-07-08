"use client";

import { getFirebaseAuth } from "./firebase-client";

/** Shown when authFetch runs before Firebase restores the session or after sign-out. */
export const AUTH_FETCH_NOT_AUTHENTICATED_MESSAGE =
  "ログイン状態を確認できませんでした。再読み込みしてください。";

/** Attach a fresh Firebase ID token as Bearer on every API call (#14). */
export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const auth = getFirebaseAuth();
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) {
    throw new Error(AUTH_FETCH_NOT_AUTHENTICATED_MESSAGE);
  }

  const token = await user.getIdToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  return fetch(input, {
    ...init,
    headers,
  });
}
