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
import { provisionUser } from "./provision";

function getAuthErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Authentication failed";
}

export async function signInWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  // #region agent log
  fetch('http://127.0.0.1:7664/ingest/883f5353-0239-41eb-8ec0-112d036ddcef',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5682c9'},body:JSON.stringify({sessionId:'5682c9',hypothesisId:'A,C,D',location:'client-auth.ts:signInWithGoogle:entry',message:'before signInWithPopup',data:{hostname:window.location.hostname,origin:window.location.origin,authDomain:auth.config.authDomain,apiKey:String(auth.config.apiKey).slice(0,8)+'...'},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  try {
    const credential: UserCredential = await signInWithPopup(auth, provider);
    await provisionUser(credential.user);
    return credential.user;
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7664/ingest/883f5353-0239-41eb-8ec0-112d036ddcef',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5682c9'},body:JSON.stringify({sessionId:'5682c9',hypothesisId:'A,C,D',location:'client-auth.ts:signInWithGoogle:error',message:'signInWithPopup failed',data:{hostname:window.location.hostname,code:(error as {code?:string})?.code ?? null,message:error instanceof Error ? error.message : String(error)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    throw error;
  }
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
