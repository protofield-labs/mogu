const FIREBASE_AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "メールアドレスまたはパスワードが正しくありません。",
  "auth/invalid-email": "メールアドレスの形式が正しくありません。",
  "auth/user-disabled": "このアカウントは無効になっています。",
  "auth/user-not-found": "メールアドレスまたはパスワードが正しくありません。",
  "auth/wrong-password": "メールアドレスまたはパスワードが正しくありません。",
  "auth/email-already-in-use": "このメールアドレスはすでに登録されています。",
  "auth/weak-password": "パスワードは6文字以上にしてください。",
  "auth/popup-closed-by-user": "ログインがキャンセルされました。",
  "auth/cancelled-popup-request": "ログインがキャンセルされました。",
  "auth/too-many-requests":
    "試行回数が多すぎます。しばらくしてから再度お試しください。",
  "auth/network-request-failed":
    "ネットワークエラーが発生しました。接続を確認してください。",
  "auth/operation-not-allowed": "このログイン方法は現在利用できません。",
  "auth/account-exists-with-different-credential":
    "別の方法で登録済みのアカウントです。",
};

const DEFAULT_LOGIN_MESSAGE =
  "ログインに失敗しました。時間をおいて再度お試しください。";
const DEFAULT_SIGNUP_MESSAGE =
  "アカウント作成に失敗しました。時間をおいて再度お試しください。";

export function getFirebaseAuthErrorCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return null;
}

export function formatFirebaseAuthError(
  error: unknown,
  context: "login" | "signup" = "login",
): string {
  const code = getFirebaseAuthErrorCode(error);
  if (code && code in FIREBASE_AUTH_ERROR_MESSAGES) {
    return FIREBASE_AUTH_ERROR_MESSAGES[code]!;
  }
  return context === "signup" ? DEFAULT_SIGNUP_MESSAGE : DEFAULT_LOGIN_MESSAGE;
}
