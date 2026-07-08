# React ベストプラクティス（mogu）

React / Next.js のパフォーマンスと設計の基準は、リポジトリ導入済みの
Skill を正とする。このファイルは参照の入り口と mogu 固有の補足のみ。

## 参照する Skill

| Skill | 用途 |
| --- | --- |
| `.agents/skills/vercel-react-best-practices/` | パフォーマンス最適化（waterfall 排除・バンドル・再レンダリング等、70 ルール） |
| `.agents/skills/vercel-composition-patterns/` | コンポーネント設計（boolean prop 増殖の回避・compound components・Context 設計） |
| `.agents/skills/fixing-accessibility/` | a11y 監査と修正（アクセシブルネーム・キーボード・フォーカス・フォーム） |

## 適用ルール

- 新規コードは Skill の基準で書く。
- 既存ファイルは触る PR の中で基準に寄せる（ボーイスカウト・ルール）。
  触らないコードの一斉リファクタはしない。
- UI 変更を含む作業では `fixing-accessibility` の critical 項目
  （アクセシブルネーム / キーボード到達性 / フォーカス管理）を必ず確認する。

## mogu 固有の優先順位（Skill より優先）

- デザイン実装は `docs/design-tokens.md` が決定事項。Skill の一般論と
  衝突したら design-tokens に従う（例: borderless elevation、terracotta
  primary、`PageTitle` の配置）。
- データ取得はクライアント側 `authFetch()` + Route Handlers が既定
  （Bearer 検証 → RLS）。Server Components でのデータ取得へ移行する場合は
  認可フロー（`apps/web/.cursor/rules/mogu-core.mdc`）を壊さないこと。
- セッション横断のプロフィールは `MeProvider` / `useMe()`（#202）を使う。
  画面ごとに `/api/v1/me` を再フェッチしない。
- 依存の追加（`pnpm add`）は人間の承認が必要（`apps/web/AGENTS.md`）。
  Skill が推奨するライブラリでも勝手に導入しない。
