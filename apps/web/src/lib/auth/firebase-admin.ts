import "server-only";

import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";

let initialized = false;

/** Initialize Firebase Admin with ADC (no service account keys) on Cloud Run / local. */
export function ensureFirebaseAdmin(): void {
  if (initialized || getApps().length > 0) {
    initialized = true;
    return;
  }

  initializeApp({
    credential: applicationDefault(),
    projectId: process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCP_PROJECT,
  });
  initialized = true;
}
