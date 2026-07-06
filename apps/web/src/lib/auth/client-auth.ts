"use client";

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  type User,
  type UserCredential,
} from "firebase/auth";

import { getFirebaseAuth } from "./firebase-client";
import { formatFirebaseAuthError } from "./firebase-auth-errors";
import { provisionUser } from "./provision";

export type AuthErrorContext = "login" | "signup";

function getAuthErrorMessage(
  error: unknown,
  context: AuthErrorContext = "login",
): string {
  return formatFirebaseAuthError(error, context);
}

export async function signInWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  const credential: UserCredential = await signInWithPopup(auth, provider);
  await provisionUser(credential.user);
  return credential.user;
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<User> {
  const auth = getFirebaseAuth();
  const credential = await signInWithEmailAndPassword(auth, email, password);
  await provisionUser(credential.user);
  return credential.user;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<User> {
  const auth = getFirebaseAuth();
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    password,
  );
  await provisionUser(credential.user, displayName);
  return credential.user;
}

export { getAuthErrorMessage };
