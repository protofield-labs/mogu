# mogu デザイントークン

> shadcn/ui（neutral / base-nova）をベースに、mogu 固有トークンを CSS variables で定義する。
> **コンポーネントから生 hex を書かない。** Tailwind ユーティリティまたは `var(--token)` のみ使う。

## 定義場所

- shadcn テーマ: `apps/web/src/app/globals.css` の `:root` / `@theme inline`
- 実装参照: `apps/web/components.json`（`baseColor: neutral`）

## shadcn セマンティックトークン

| トークン | Tailwind 例 | 用途 |
| --- | --- | --- |
| `--background` | `bg-background` | アプリ背景（warm neutral） |
| `--foreground` | `text-foreground` | 本文テキスト |
| `--card` | `bg-card` | カード・吹き出し（白） |
| `--muted` | `bg-muted` | ユーザー吹き出し・サブ背景 |
| `--primary` | `bg-primary` | 主要ボタン・強調 |
| `--border` | `border-border` | 枠線 |
| `--radius` | `rounded-lg` 等 | 角丸基準（0.75rem） |

## mogu プロダクトトークン

| CSS variable | Tailwind 例 | 用途 |
| --- | --- | --- |
| `--mogu-surface` | `bg-mogu-surface` | 画面背景（= `--background`） |
| `--mogu-surface-elevated` | `bg-mogu-surface-elevated` | カード・モーダル（= `--card`） |
| `--mogu-avatar-default` | `bg-mogu-avatar-default` | アバター未設定時（DB デフォルト `#888888` 相当） |
| `--mogu-avatar-ring-new` | `ring-mogu-avatar-ring-new` | 新着リング（ホーム1b アバター行） |
| `--mogu-avatar-ring-idle` | `ring-mogu-avatar-ring-idle` | 通常アバター枠 |
| `--mogu-badge` | `bg-mogu-badge` | タブ・統計行の赤ドット |
| `--mogu-spacing-screen-x` | `px-mogu-screen-x` | 画面左右余白 |
| `--mogu-spacing-screen-y` | `py-mogu-screen-y` | 画面上下余白 |
| `--mogu-tab-bar-height` | `h-mogu-tab-bar` | 下部3タブの高さ |
| `--mogu-shell-max-width` | `max-w-mogu-shell` | PC 中央寄せ時の最大幅 |

## チャット部品（検索2b）

shadcn チャット primitives を `@/components/chat` から import する。

| 部品 | 用途 |
| --- | --- |
| `Message` / `MessageContent` | 行レイアウト（agent=start / user=end） |
| `Bubble` / `BubbleContent` | 吹き出し（agent=`outline` / user=`muted` 推奨） |
| `MessageScroller` | 会話スクロール・最新へジャンプ |
| `Marker` | 思考の可視化（「Kenのコレクションを参照中…」） |

## 禁止事項

- コンポーネント内に `#F5F3EF` 等の生 hex を書かない
- magic number の余白（`p-[13px]` 等）を増やさない。トークンまたは Tailwind スケールを使う
- ダークモードは MVP スコープ外（`.dark` は shadcn デフォルトを残すのみ）

## 参照

- Issue #52
- ワイヤー: `docs/wireframes/home-1b.png`, `search-2b.png`, `mypage-3a.png`
