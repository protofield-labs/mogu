import "server-only";

import { cache } from "react";
import { getAuth } from "firebase-admin/auth";

import { ensureFirebaseAdmin } from "./firebase-admin";

export type VerifiedSession = {
  uid: string;
};

/**
 * Verify Bearer ID token from a Route Handler request (#14).
 * Memoized per request via React cache().
 */
export const verifySession = cache(
  async (request: Request): Promise<VerifiedSession | null> => {
    const header = request.headers.get("authorization");
    if (!header?.startsWith("Bearer ")) {
      return null;
    }

    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      return null;
    }

    ensureFirebaseAdmin();

    try {
      const decoded = await getAuth().verifyIdToken(token);
      return { uid: decoded.uid };
    } catch {
      return null;
    }
  },
);
