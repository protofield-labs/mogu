# mogu デザイントークン

> shadcn/ui（neutral / base-nova）をベースに、mogu 固有トークンを CSS variables で定義する。
> **コンポーネントから生 hex を書かない。** Tailwind ユーティリティまたは `var(--token)` のみ使う。

## 定義場所

- shadcn テーマ: `apps/web/src/app/globals.css` の `:root` / `.dark` / `@theme inline`
- 実装参照: `apps/web/components.json`（`baseColor: neutral`）
- フォント: `apps/web/src/app/layout.tsx`（Geist + Noto Sans JP）
- ダークモード: `next-themes`（`defaultTheme="system"`）— Issue #129

## shadcn セマンティックトークン

| トークン | 値（参考） | Tailwind 例 | 用途 |
| --- | --- | --- | --- |
| `--background` | warm neutral | `bg-background` | アプリ背景 |
| `--foreground` | ほぼ黒 | `text-foreground` | 本文テキスト |
| `--card` | warm off-white | `bg-card` | カード・吹き出し |
| `--muted` | 薄い neutral | `bg-muted` | ユーザー吹き出し・サブ背景 |
| `--primary` | terracotta `oklch(0.62 0.14 45)` | `bg-primary` | 主要 CTA・選択ピル・アクティブタブ |
| `--primary-foreground` | ほぼ白 | `text-primary-foreground` | primary 上の文字 |
| `--border` | 薄い neutral | `border-border` | 区切り線・入力枠（カード面には使わない） |
| `--ring` | primary 35% | `ring-ring` | フォーカスリング |
| `--radius` | 0.75rem | `rounded-lg` 等 | 角丸基準 |

## mogu プロダクトトークン

| CSS variable | Tailwind 例 | 用途 |
| --- | --- | --- |
| `--mogu-surface` | `bg-mogu-surface` | 画面背景（= `--background`） |
| `--mogu-surface-elevated` | `bg-mogu-surface-elevated` | カード・モーダル（= `--card`） |
| `.mogu-elevated` | `mogu-elevated` | elevated 背景 + `shadow-md`（#101） |
| `--mogu-avatar-default` | `bg-mogu-avatar-default` | アバター未設定時 |
| `--mogu-avatar-ring-new` | `ring-mogu-avatar-ring-new` | 新着リング（= `--primary`） |
| `--mogu-avatar-ring-idle` | `ring-mogu-avatar-ring-idle` | 通常アバター枠 |
| `--mogu-badge` | `bg-mogu-badge` | タブ・統計行の赤ドット |
| `--mogu-spacing-screen-x` | `px-mogu-screen-x` | 画面左右余白 |
| `--mogu-spacing-screen-y` | `py-mogu-screen-y` | 画面上下余白 |
| `--mogu-tab-bar-height` | `h-mogu-tab-bar` | 下部3タブの高さ |
| `--mogu-shell-max-width` | `max-w-mogu-shell` | PC 中央寄せ時の最大幅 |
| `--mogu-radius-card` | `rounded-mogu-card` | 画面カードの標準角丸（1.25rem） |

## タイポグラフィ

| 変数 | フォント | 用途 |
| --- | --- | --- |
| `--font-noto-sans-jp` | Noto Sans JP | 日本語 UI |
| `--font-geist` | Geist | 英数字・記号 |
| `--font-sans` | 上記のスタック | `font-sans` デフォルト |

各タブ冒頭に `PageTitle`（`text-2xl font-semibold`）を置き、画面文脈を即伝える（#101）。

## Elevation ルール（#101）

- **カード面**: `border` なし。`bg-mogu-surface-elevated` + `shadow-md` + `rounded-mogu-card`
- **ホバー**: `hover:shadow-lg`（タイル・プロモカード）
- **入力・ダイアログ**: `border-border` は入力欄・確認ダイアログ・リスト区切り線に限定
- **実装**: `SurfaceCard` / `.mogu-elevated` が標準。個別カードは `shadow-md` を直接付与可

## アクセント適用先ルール（#90 + #101）

画面の 95% はモノクローム（background / foreground / muted）。`--primary` は次だけ:

| 適用先 | 例 |
| --- | --- |
| アクティブタブ | タブバーアイコン / マイページアバターリング |
| 主要 CTA | `Button` default / `size="cta"` |
| 新着リング | `Avatar` `showNewRing` |
| NEW バッジ | 友達タイル `Badge variant="alert"` |
| 選択中フィルターピル | `filterPillClass(selected: true)` |
| 営業中ラベル等 | 断言カードの `text-primary` |

## ナビゲーションの型（#101）

| 型 | コンポーネント | 用途 |
| --- | --- | --- |
| **タイルカード** | `MypageNavTiles` 等 | 2列グリッド・ビジュアル + 短ラベル（コレクション / 友達） |
| **設定行** | `NavRow` | アイコン + ラベル + シェブロン・全幅タップ（アカウント設定） |
| **プロモカード** | マイページ空状態等 | イラスト/アイコン + 1行コピー + 全体タップ |

## フィードバック

- 保存成功: `sonner` トースト（`showRecollectSuccessToast`）
- 新着リング: 2回だけの subtle pulse（`mogu-avatar-ring-new-pulse`）

## チャット部品（検索2b）

| 部品 | 用途 |
| --- | --- |
| `Message` / `Bubble` | 会話行・吹き出し |
| `MessageScroller` | 会話スクロール |
| `filterPillClass` | 構造化チップ・クイックリプライ（全丸ピル） |

## 禁止事項

- コンポーネント内に生 hex を書かない
- magic number 余白を増やさない
- カード面に `border border-border` を付けない（入力・リスト区切りは除く）

## 参照

- Issue #52, #90, #101, #129
- ワイヤー: `docs/wireframes/home-1b.png`, `search-2b.png`, `mypage-3a.png`
