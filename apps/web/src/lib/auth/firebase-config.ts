/** Firebase Web SDK config (public; safe to commit). Populated from Terraform outputs / .env. */
export type FirebaseClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
};

export function readFirebaseClientConfig(): FirebaseClientConfig {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
    process.env.NEXT_PUBLIC_GCP_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  if (!apiKey || !authDomain || !projectId || !appId) {
    throw new Error(
      "Firebase client config is incomplete. Set NEXT_PUBLIC_FIREBASE_* environment variables.",
    );
  }

  return { apiKey, authDomain, projectId, appId };
}

export function readFirebaseAuthEmulatorHost(): string | undefined {
  return process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
}
