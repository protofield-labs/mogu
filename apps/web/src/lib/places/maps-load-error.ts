/** User-facing copy when Maps JavaScript API fails to render (#185). */
export const MAPS_LOAD_ERROR_MESSAGE = {
  missingKey:
    "地図を表示するには Google Maps API キー（NEXT_PUBLIC_GOOGLE_MAPS_API_KEY）の設定が必要です。",
  scriptLoad:
    "地図スクリプトの読み込みに失敗しました。ネットワーク接続を確認して再度お試しください。",
  authFailure:
    "地図を表示できません。Google Maps API キー、Billing、referrer 制限（http://localhost:3000/* または Cloud Run URL）を確認してください。",
  tilesTimeout:
    "地図タイルを読み込めませんでした。Maps JavaScript API が有効か、API キーが正しいか確認してください。",
} as const;

export type MapsLoadFailureKind =
  | "scriptLoad"
  | "authFailure"
  | "tilesTimeout";

export function mapsLoadErrorMessage(kind: MapsLoadFailureKind): string {
  return MAPS_LOAD_ERROR_MESSAGE[kind];
}
