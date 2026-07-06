/**
 * Firebase Auth error message mapping verification (#88).
 * Run via: pnpm exec tsx scripts/verify-firebase-auth-errors.ts
 */
import {
  formatFirebaseAuthError,
  getFirebaseAuthErrorCode,
} from "../src/lib/auth/firebase-auth-errors";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function firebaseError(code: string) {
  return { code, message: `Firebase: Error (${code}).` };
}

function main() {
  assert(
    getFirebaseAuthErrorCode(firebaseError("auth/invalid-credential")) ===
      "auth/invalid-credential",
    "extract firebase error code",
  );
  assert(getFirebaseAuthErrorCode(new Error("plain")) === null, "ignore plain errors");

  assert(
    formatFirebaseAuthError(firebaseError("auth/invalid-credential"), "login") ===
      "メールアドレスまたはパスワードが正しくありません。",
    "invalid credential login copy",
  );
  assert(
    formatFirebaseAuthError(firebaseError("auth/email-already-in-use"), "signup") ===
      "このメールアドレスはすでに登録されています。",
    "email already in use copy",
  );
  assert(
    formatFirebaseAuthError(firebaseError("auth/weak-password"), "signup") ===
      "パスワードは6文字以上にしてください。",
    "weak password copy",
  );
  assert(
    formatFirebaseAuthError(firebaseError("auth/popup-closed-by-user"), "login") ===
      "ログインがキャンセルされました。",
    "popup closed copy",
  );
  assert(
    formatFirebaseAuthError(firebaseError("auth/unknown-code"), "login") ===
      "ログインに失敗しました。時間をおいて再度お試しください。",
    "login fallback copy",
  );
  assert(
    formatFirebaseAuthError(firebaseError("auth/unknown-code"), "signup") ===
      "アカウント作成に失敗しました。時間をおいて再度お試しください。",
    "signup fallback copy",
  );

  console.log("PASS: firebase auth error messages verified");
}

main();
