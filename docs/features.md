# mogu 機能一覧 v1(構成確定版: ホーム1b / 検索2b / マイページ3a)

> 前提: 認証(ログイン/サインアップ、ページ含む)は**実装済み**。タブは3つ(ホーム / 検索[中央] / マイページ)。
> 優先度: **MVP** = 7/9提出に必須 / **磨き** = 6/24〜7/3の磨き込み枠 / **将来** = 記事・ピッチで語る枠

---

## 0. 基盤(実装済み・継続)

| # | 機能 | 状態 | 備考 |
| --- | --- | --- | --- |
| 0-1 | サインアップ / ログイン(Email+Password, Google) | ✅ 済 | Firebase Authentication |
| 0-2 | 認可ブリッジ(Bearer検証 → `set_config` → RLS) | MVP | 全APIの共通ミドルウェア |
| 0-3 | オンボーディング(初回: 名前・アバターカラー設定) | MVP | `POST /users`。最小1画面 |

## 1. ホーム(1b: 一推し1行圧縮・フィード先行)

| # | 機能 | 優先度 | 備考 |
| --- | --- | --- | --- |
| 1-1 | アバター行(友達+新着リング+招待チップ) | MVP | 新着リング=既読管理(24hで消えない) |
| 1-2 | 一推しコンパクト行(1行・タップでS2断言へ) | MVP | `GET /home/recommendation`。1日1枚 |
| 1-3 | 新着フィード(時系列・非アルゴリズム) | MVP | `GET /feed?cursor=`。カード=写真+via+3段階+一言 |
| 1-4 | フィードからのリコレクション(保存ボタン) | MVP | `POST /spots/{id}/recollect` |
| 1-5 | 「輪でn人が保存」表示 | MVP | 読み取り時集計(閲覧者の輪相対) |
| 1-6 | ソロ期の空状態(招待チップ+入力誘導) | MVP | デモは種データ主体だが空状態も1画面 |
| 1-7 | 文脈トリガー更新(金曜夕方の一推し差し替え) | 磨き | Ambientパターン。デモ映え枠 |

## 2. 検索(2b: チャット型・エージェント対話)

| # | 機能 | 優先度 | 備考 |
| --- | --- | --- | --- |
| 2-1 | エージェント起点の対話開始(「今夜はどんな気分？」) | MVP | セッション生成 `POST /agent/sessions` |
| 2-2 | 自由文入力+構造化チップ(エリア/人数/ジャンル/シチュエーション) | MVP | チップはメッセージに合成して送信 |
| 2-3 | マルチターン応答(聞き返し→絞り込み) | MVP | Vertex AI Sessions(短期文脈)。**核体験** |
| 2-4 | 思考の可視化(「Kenのコレクションを参照中…」) | MVP | ADKイベントをSSE/ポーリングで進行表示。基準①の視覚証拠 |
| 2-5 | 断言カード(1件+根拠evidence+副候補2件折りたたみ) | MVP | メッセージ内にRecommendationを内包 |
| 2-6 | 「なぜこの店?」展開(参照した棚・タグ・文脈) | 磨き | 段階的透明性。1タップ先に置く |
| 2-7 | 断言からの地図で開く / リコレクション | MVP | 地図はGoogle Maps遷移(参照モデル) |
| 2-8 | 営業状況チェック(鮮度シグナル) | MVP | Places都度取得の`openNow` |
| 2-9 | クイックリプライチップ(「もっと静かな店」等) | 磨き | 応答に選択肢を同梱 |
| 2-10 | Memory Bank参照(過去の嗜好を断言に反映) | 磨き | 長期記憶。差別化の柱 |

## 3. マイページ(3a: インスタ型+友達サブ画面)

| # | 機能 | 優先度 | 備考 |
| --- | --- | --- | --- |
| 3-1 | プロフィールヘッダ(統計行: コレクションn/スポットn/友達n) | MVP | `GET /me`にcounts同梱 |
| 3-2 | コレクション棚グリッド(カバー/自動カバー、secret鍵) | MVP | `GET /collections?ownerId=me` |
| 3-3 | コレクション作成/編集/削除(名前・説明・公開範囲・テーマ) | MVP | CRUD一式 |
| 3-4 | スポット追加(place検索→一言・3段階・タグ・写真) | MVP | `GET /places/search`(オートコンプリート)+`POST /collections/{id}/spots` |
| 3-5 | 写真アップロード(ユーザー撮影→Cloud Storage) | MVP | 署名付きURL。Place Photosは保存しない |
| 3-6 | 友達リスト(統計行タップ→サブ画面) | MVP | 承認済み一覧+友達のマイページへ |
| 3-7 | 友達申請(検索→申請→承認/拒否) | MVP | 承認前はコレクション非表示(鍵) |
| 3-8 | 申請受信バッジ(タブ+友達数の赤ドット) | MVP | `GET /me/badges`(申請数+未読フラグ数) |
| 3-9 | 招待リンク共有(LINE) | 磨き | MVPは友達検索で代替可 |
| 3-10 | フラグ受信箱(実名/匿名の週次サマリ) | MVP | `GET /flags`。本人のみ |
| 3-11 | コレクション末尾のエージェント提案(「この棚に合いそう」) | 磨き | `GET /collections/{id}/suggestions` |
| 3-12 | 記録の利子ヒント表示 | 磨き | 静的コピーで開始可 |

## 4. エージェント/バックグラウンド(画面外)

| # | 機能 | 優先度 | 備考 |
| --- | --- | --- | --- |
| 4-1 | オーケストレーター+ペルソナ(Ken/Aoi)AgentTools | MVP | 確定アーキテクチャ |
| 4-2 | Maps Groundingエージェント(分離) | MVP | 組み込みツール共存制約のため別エージェント |
| 4-3 | 一推しの夜間バッチ生成(daily_recommendations) | MVP | Cloud Scheduler。※前スレの未決論点→本構成では夜間バッチを推奨(2bのリアルタイム負荷を検索に集中させるため) |
| 4-4 | 夜警エージェント(閉店検知・巡回ログ) | 磨き | 記事図版の素材化を仕込む |
| 4-5 | evals / observability(推論トレース・コスト) | 磨き | 基準⑤+最優秀賞のDevOps実践度 |

## 5. 将来枠(記事・ピッチで語る)

食のWrapped / 共同コレクション(幹事エージェント) / pgvectorセマンティック検索(Phase 2) / オンボーディング一括救出(スクショ取り込み)

---

# ERD / API への影響

## ERD: **変更なし(追加テーブルゼロ)**

チャット(2b)の会話状態はCloud SQLに置かず、**Vertex AI Sessions(Agent Engine)**に置く。

- 短期文脈(会話中の聞き返し・絞り込み)= Sessions。TTLで自動失効し、使い捨て
- 長期記憶(嗜好・人格)= Memory Bank(既存計画)。**同一のAgent Engineインスタンスで両方賄える**
- ファクト(スポット/棚/友達/フラグ)= Cloud SQL(既存ERDのまま)

理由: Cloud RunスケールでInMemoryは不可。DatabaseSessionService(Cloud SQL相乗り)も可能だが、ADKがスキーマを所有しバージョン更新で移行が発生するため、自前ERDと混ぜない方が安全。Memory Bank用に作るAgent Engineがセッションストアを兼ねるので追加コストほぼゼロ、かつ「Sessions+Memory Bankの使い分け」自体がGoogle Cloudらしい構成として記事の一節になる。

マイページ3aの統計行(コレクションn/スポットn/友達n)もすべて既存テーブルのCOUNTで賄えるため、カラム追加なし。

## API: 差分は3点

**① `POST /search` を廃止し、対話系に置き換え(唯一の構造変更)**

| Method | Path | Req | Res |
| --- | --- | --- | --- |
| POST | `/agent/sessions` | — | `{sessionId}`(TTL付きで生成) |
| POST | `/agent/sessions/{id}/messages` | `{text, chips?}` | `AgentMessage` |
| GET | `/agent/sessions/{id}/events` | (SSE or ポーリング) | 思考進行イベント(2-4用) |

```typescript
export type AgentMessage = {
  role: 'agent'
  text: string                        // 聞き返し or 断言の地の文
  thinking?: string[]                 // 「Kenのコレクションを参照中…」(表示済み進行の確定ログ)
  recommendation?: Recommendation     // 断言に到達したターンのみ内包
  quickReplies?: string[]             // 「もっと静かな店」等のチップ
}
```

既存の`Recommendation`型はそのまま再利用(ホーム1bの一推しと共通)。

**② `GET /me` にcountsを同梱(3a統計行用)**

```typescript
export type Me = User & {
  counts: { collections: number; spots: number; friends: number }
}
```

**③ `GET /me/badges` を追加(3-8バッジ用・軽量)**

```typescript
{ pendingFriendRequests: number; unreadFlags: number }
```

その他(feed / collections / spots / recollect / flags / friends / places)は**v1定義のまま変更なし**。ホーム1bは表示圧縮のみでAPI同一。友達タブ廃止もエンドポイントの移動は不要(呼び出し元画面が変わるだけ)。
