# 自律インシデントAgent 仕様

> 本番(Cloud Run / Cloud SQL)を監視し、アラート発火時に自律的に一次切り分けを行うエージェントの設計仕様。

---

## 0. 概要

アラートが発火したら、エージェントが自らログとメトリクスを取得し、過去のインシデント記録(pgvector)と照合して一次切り分け(根本原因の仮説・重大度・推奨アクション)を行い、SlackとGitHub Issueで人間に渡す。**本番環境には一切変更を加えない(読み取り専用)。**

ワークフロー(事前定義された固定パイプライン)ではなくエージェントとして構成する理由: インシデント調査は非線形で、必要なステップ数・順序・使用ツールが事前に確定できない。LoopAgentは観察結果に基づいて「調査を続けるか・方針を変えるか・停止するか」を実行時に自己判断する。ただし外枠(反復上限・予算上限・IAM権限)は決定論的な制約で固定する。

## 1. スコープ(段階構成)

| フェーズ | 範囲 |
| --- | --- |
| **Phase A** | アラート受信 → LoopAgent(最大3反復)による一次切り分け → Slack通知 + GitHub Issue起票。pgvector類似検索。プレイブック注入。多層ノイズ制御。Slackスレッドでの対話型二次切り分け(I6) |
| **Phase B** | ①ポストモーテム自動生成 → pgvector(自動)/プレイブック(PR+人間レビュー)へ還流 ②依存グラフ(再帰CTE)によるトポロジー抑制 ③承認付きアクション(ToolConfirmation) |
| **恒久スコープ外** | 自動緩和・本番変更・自動デプロイ/ロールバック。人間の承認なしに本番を変える機能は実装しない |

## 2. アーキテクチャ

```
Cloud Monitoring アラートポリシー発火
  │  (通知チャネル: Pub/Sub topic "incident-alerts")
  ▼
Pub/Sub ──OIDC push──▶ Cloud Run service「incident-agent-ingest」(非公開)
                     │ 1. 多層ノイズ制御(§9 L1〜L4。既存インシデントへの集約 or ストーム集約)
                     │ 2. 自己監視除外(対象が自分なら即終了)
                     │ 3. コストサーキットブレーカー(実行前チェック)
                     │ 4. ops.incidentsにinvestigating行を確保(調査オーナーを1つに固定)
                     ▼
                  ADK LoopAgent(最大3反復・確信度で早期終了)
                     ├─ playbook注入(アラート種別に対応する1枚のみ)
                     ├─ tool: get_metrics   (Cloud Monitoring API・読取)
                     ├─ tool: get_logs      (Cloud Logging API・読取)
                     └─ tool: search_similar_incidents (pgvector類似検索)
                     ▼
                  一次切り分け結果(仮説・重大度・推奨アクション・根拠・確信度)
                     ├─ Cloud SQL "ops" スキーマへ保存(マスキング済みアラート+分析+埋め込み)
                     ├─ Slack 通知(スレッド起点)
                     └─ GitHub Issue 起票(ラベル: incident)

Slackスレッドで @incident-agent に追加質問(I6)
  → app_mention → Cloud Run service「incident-agent-slack」(公開・Slack署名必須)
  → event_id登録 + Cloud Tasks enqueue → 即ACK
  → private workerでteam_id+channel+thread_ts照合 → session_id = ops.incidents.id
  → 同じ読み取り専用ツールで追調査 → スレッドに返信(対話型二次切り分け)
```

### 分離の原則(別Cloud Runサービスとする理由)

**mogu本体(dev-web)とincident-agentを分離し、さらに受信認証方式が異なる2つのAgentサービスに分ける。** ADK LoopAgentは各サービスのコンテナ内で動くライブラリであり、別サービスとして呼び出すものではない。Agentのコードとイメージは共有し、エントリーポイントを分ける。デプロイ単位は「dev-web」「incident-agent-ingest」「incident-agent-slack」の3つ。

1. **ライフサイクル**: アプリは常時稼働、Agentはイベント駆動(発火時のみ起動→終了)。
2. **障害の独立性**: 監視する側が監視される側と同居すると、アプリ障害時にAgentも停止する。分離により「アプリが落ちてもAgentは切り分けを継続」が成立。
3. **権限分離**: Agent専用サービスアカウントに最小権限(§7)。アプリのSAには監視系権限を付与しない。
4. **入口の分離**: Pub/SubはCloud Run IAM+OIDCで閉じ、Slack Eventsは公開URLでSlack署名を検証する。同一サービスにするとSlack対応のための公開設定がPub/Sub受信口にも及ぶため、サービスを分離して認証境界を保つ。

### 統合方式: MCPは使わない

ツールはADKのfunction toolからCloud Monitoring/Logging クライアントライブラリを直接呼ぶ。認証はサービスアカウント(ADC)。MCPは接続の規格であり、単一エージェント+全Google純正APIの本構成では、ホスティング・認証・障害点を増やすのみで利点がない。将来、同一ツール群を他エージェント/クライアントと共有する段になった場合にMCP化を検討する(Phase B以降の選択肢)。

## 3. データモデル(Cloud SQL / "ops" スキーマ)

アプリのデータとスキーマを分離する。ops専用DBロールを作り、アプリ用テーブルへのアクセス権を与えない(逆も同様)。ユーザーデータではないためRLS対象外だが、最小権限の原則は同じ。

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS ops;

CREATE TABLE ops.incidents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_key   text NOT NULL,          -- §9 L1のcanonical JSONをSHA-256。未解決期間内の完全一致キー
  alert_policy   text NOT NULL,
  resource       text NOT NULL,          -- 例: cloud_run/dev-web
  severity       text,                   -- agent判定: critical/high/medium/low。調査前はNULL
  raw_alert      jsonb NOT NULL,         -- §7-10でマスキング済み。原文は保存しない
  rca_hypothesis text,                   -- 仮説・根拠・推奨・確信度
  playbook_used  text,                   -- 使用したプレイブック名
  loop_count     int NOT NULL DEFAULT 0, -- 実反復回数
  token_cost     numeric,                -- 1調査の推定コスト
  status         text NOT NULL DEFAULT 'investigating'
    CHECK (status IN ('investigating', 'analyzed', 'escalated', 'resolved', 'merged')),
  alert_count    int NOT NULL DEFAULT 1 CHECK (alert_count > 0),
  last_seen_at   timestamptz NOT NULL DEFAULT now(),
  merged_into    uuid REFERENCES ops.incidents(id),
  investigation_token uuid NOT NULL DEFAULT gen_random_uuid(),
  lease_expires_at timestamptz NOT NULL DEFAULT (now() + interval '6 minutes'),
  attempt_count  int NOT NULL DEFAULT 1 CHECK (attempt_count BETWEEN 1 AND 3),
  github_issue   text,
  slack_team     text,
  slack_channel  text,
  slack_thread   text,                   -- thread_ts。I6のsession_idはincidentのidを使う
  embedding      vector(768) NOT NULL,   -- I2の調査予約時に保存。gemini-embedding-001 / output_dimensionality=768
  created_at     timestamptz NOT NULL DEFAULT now(),
  resolved_at    timestamptz,
  CHECK ((status = 'resolved') = (resolved_at IS NOT NULL)),
  CHECK ((status = 'merged') = (merged_into IS NOT NULL))
);
CREATE INDEX ON ops.incidents USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON ops.incidents (created_at DESC);
CREATE UNIQUE INDEX incidents_open_incident_key
  ON ops.incidents (incident_key)
  WHERE resolved_at IS NULL AND status <> 'merged';
CREATE INDEX ON ops.incidents (resource, last_seen_at DESC)
  WHERE resolved_at IS NULL AND status <> 'merged';

CREATE TABLE ops.slack_events (
  event_id    text PRIMARY KEY,
  task_name   text NOT NULL UNIQUE,
  status      text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempt_count int NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 3),
  lease_expires_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX ON ops.slack_events (received_at);

-- Phase B:
-- CREATE TABLE ops.postmortems (...);
-- CREATE TABLE ops.component_deps (from_c text, to_c text);  -- 再帰CTE用
```

## 4. LoopAgent 設計

```
LoopAgent(max_iterations=3):        # 調査サイクルの最大周回数(絶対上限)
  ├─ investigator (LlmAgent)
  │    入力: アラート + プレイブック + これまでの証拠
  │    行動: 仮説を立て、不足する証拠を get_metrics / get_logs で取得。
  │          search_similar_incidents で過去事例(上位3件)を照合
  └─ evaluator (LlmAgent)
       判定: 根本原因を特定するに足る証拠が揃ったか
       - 確信(confidence high) → exit_loop(1周目でも早期終了)
       - 不足 → 何が足りないかを明示して次の周へ
```

- **max_iterations=3 の意味**: investigator→evaluator を1周とし、最大3周。毎回3周するわけではない(確信すれば早期終了)。最大コスト = 3周 × 周あたりトークン上限。
- 各周の取得ログは直近N分・最大行数を制限(コンテキスト肥大の防止)。
- 出力フォーマット(固定): `仮説(1文) / 根拠(参照したログ・メトリクス・類似事例) / 重大度 / 推奨アクション(人間向け) / 確信度`。根拠にログを含める場合は§7-10のマスキング後の要約のみ(Slack/GitHub投稿前に適用)。
- 類似事例ヒット時は「過去の類似: <日付> <一言> → 当時の原因はX」を根拠に含める。

## 5. ツール定義(すべて読み取り専用・function tool直実装)

| tool | 中身 | 制限 |
| --- | --- | --- |
| `get_metrics` | Cloud Monitoring API(timeSeries.list) | `ops.incidents.resource`へサーバー側で固定・直近60分に限定 |
| `get_logs` | Cloud Logging API(entries.list) | `ops.incidents.resource`へサーバー側で固定・severity>=WARNING・最大200行。出力は§7-10のマスキングを経由 |
| `search_similar_incidents` | 解決済みのops.incidentsをpgvector cos類似検索し、過去の原因を調査根拠にする | `status='resolved' AND rca_hypothesis IS NOT NULL`・上位3件 |

`get_metrics` / `get_logs` のresource・project・filterは、認証済みリクエストに対応する`ops.incidents`行からサーバー側で決定論的に構築する。LLMやSlackユーザーが指定したresource/project/filterは拒否または無視し、他サービスへのクエリ拡大を許可しない。

L4の重複排除はLLM toolではなく、I2内部の決定論的DB関数`search_open_similar_incidents`として実装する。検索条件を`resolved_at IS NULL AND status <> 'merged'`に固定する。過去事例を探す`search_similar_incidents`とは同じembedding/query helperを共有してよいが、用途別のSQL条件を混在させない。

## 6. プレイブック(調査ノウハウの外部化)

`services/incident-agent/playbooks/` にアラート種別ごとのMarkdownを置き、該当する1枚だけをコンテキストに注入する(全部を常時積まない=progressive disclosure)。

```
playbooks/
  cloud_run_latency.md      # p99急増 → まずrevision差分、次にSQL接続数、既知原因
  cloud_sql_connections.md  # 接続エラー → プール設定、直近デプロイ、接続数推移
  error_rate_spike.md       # 5xx急増 → ログのスタックトレース、依存API状況
```

- 各プレイブックは簡潔に: 「最初に見るべき箇所(順)/既知の原因/確信の判断基準」。
- 効果: ①LoopAgentが少ない周回で確信に至る(コスト減) ②ドメイン知見をコードでなくMarkdownで注入・更新できる。
- 該当プレイブックがないアラート種別は、汎用の調査手順(デフォルト)で動く。
- アラート種別→ファイル名はコード内の固定マップ(allowlist)で解決する。`alert_policy`など受信値をパスへ連結しない。`..` / `/` / `\` を含む値は拒否し、解決後のパスが`playbooks/`配下であることを検証する。

### 配置(DBではなくGit管理ファイル)

プレイブックはDBに置かず、`services/incident-agent/playbooks/` のGit管理ファイルとして incident-agent イメージに同梱する(ビルド時に焼き込む)。理由:

1. **バージョン管理**: プレイブックはLoopAgentの判断の前提(実質コード)。誰が・いつ・なぜ変えたかをGitに残し、レビューを通す。
2. **読み取りが単純**: 起動時にアラート種別に対応する1枚をファイルから読み、instructionに差し込むだけ(DBクエリ不要)。
3. **役割分担と一致**: pgvector=事例(動的・DB)/ プレイブック=手順(人がレビューして固める・コード)。

反映方法: プレイブックを1枚直したら incident-agent を再デプロイして反映する(=プレイブック変更もデプロイパイプラインの検証を通る)。

### 既知と新規の二段構え

- **新規インシデントでも動く**: プレイブックは「あれば近道」であって前提条件ではない。該当プレイブックが無くてもLoopAgentは自力で仮説→ログ確認→再調査を行い、一次切り分けを試みる(確信に至らなければ「確信度低」と返す)。
- **2つの還流経路(Phase B)**:
  - pgvectorへの還流(自動・データ): 新規インシデントはI2の予約時から未解決重複排除`search_open_similar_incidents`の母集団に入り、解決後(`status='resolved'`かつRCAあり)に過去事例tool`search_similar_incidents`の母集団へ移る。ノイズは用途別の状態フィルタで分離し、事例還流は自動とする。
  - プレイブックへの還流(PR+人間レビュー・知識): 同種インシデントが繰り返し起きたら、ポストモーテムが調査手順を抽出しプレイブックを更新/新設する。**プレイブックは全調査に効きブラスト半径が大きいため、必ず人間レビューを挟む**(自動マージ禁止)。

### プレイブック更新フロー(Phase B・GitOps)

「意図はIssue、差分はPRで連結」の型を取る。

```
インシデント解決 → ポストモーテム生成(エージェント)
  → [Issue] なぜ手順を変えるべきか(rationale)+ 根拠となったインシデント# を記述
  → [PR]   playbooks/<type>.md を編集(このPRが上記Issueをclose)
  → 人間レビュー(意味の妥当性を判断。リンク切れ・語数等はCIで機械チェック)
  → マージ → incident-agent 再デプロイで反映
```

- **頻度制限**: ポストモーテム→プレイブックPRは頻度を絞る(例: 同種がN回起きて初めて提案、または夜間バッチで1日1回集約)。エージェントが大量PRを出してレビューが形骸化するのを防ぐ。
- **AIは下書き・CIは検証・人間は判断**の三分業。プレイブックPRにもCI(リンク/語数チェック)を噛ませ、意味の妥当性のみ人間が見る。
- **pgvectorとの非対称を保つ**: 事例還流=自動、手順還流=PR+レビュー。ブラスト半径の差に基づく設計。

## 7. ガードレール(すべて「事後アラート」ではなく「実行経路での強制」)

1. **読み取り専用をIAMで強制**: AgentのSAには `roles/monitoring.viewer` / `roles/logging.viewer` / `roles/cloudtrace.agent`(Trace送出のみ) / `roles/aiplatform.user`(LoopAgent・embedding・Vertex AI Sessions実行)とopsスキーマDBロール+Slack webhookを付与する。GitHub fine-grained tokenは対象リポジトリ1つに限定し、`Issues: Read and write`(Issue作成+コメント)と必須のMetadata read以外(Contents/Actions等)を付与しない。本番リソースへの書き込み系・デプロイ系ロールは一切付与しない。
2. **自己監視の除外**: アラート対象が `incident-agent` 自身なら調査せず固定文通知のみ。アラートポリシー側でも除外(二重防御)。自己言及ループの遮断。
3. **多層ノイズ制御**: §9参照。Issue数をインシデント数に収束させる。
4. **コストサーキットブレーカー**: 調査1回のトークン上限+1日あたり調査回数上限(例: 20回)を実行前チェックで強制。超過時は調査せず「上限到達」を通知して停止(fail-closed)。
5. **ログはデータとして扱う**: ログ本文内の指示には従わない旨をシステムプロンプトに明記。書き込み権限がない(1.)ことで実害を構造遮断。
6. **タイムアウトと再試行**: Cloud Runのリクエストタイムアウト(300s)が1回の調査上限。Pub/Sub ingestは分析+出力の永続化完了後にのみ2xxを返し、早期ACKしない。過渡障害は5xxでPub/Sub再送に委ね、期限切れleaseを原子的に引き継ぐ。3回失敗時はLLMなしの固定文でSlack/Issueへエスカレーションし、通知永続化まで5xxを返す。
7. **本番不変**: 環境を変更するツールを持たせない。緩和は推奨としてissueに書くだけ。実行は人間(Phase BでもToolConfirmationによる人間承認を必須とする)。
8. **Slack対話(I6)の追加ガード**: 署名+5分timestampを検証後、`event_id`と決定論的Cloud Tasks名を原子的に登録し、Task enqueue後だけ200 ACKする。workerはlease+最大3回で処理する。許可主体は設定値`ALLOWED_SLACK_TEAM_IDS` / `ALLOWED_SLACK_CHANNEL_IDS` / `ALLOWED_SLACK_USER_IDS`の3つすべてに一致する場合のみとし、未設定・空・不一致は拒否する。channel allowlistは一次通知先と一致させ、user allowlistはon-call/運用担当だけを登録する。workerはSlack複合キー、未解決状態、GitHub Issue、3 allowlist、incidentのresource allowlistを実行直前に再検証する。
9. **受信エンドポイントの認証**: `incident-agent-ingest` はunauthenticated禁止。Pub/Sub pushはOIDC JWTの署名・issuer・audience(ingestのCloud Run URL)を検証し、push用SAのみ `run.invoker`。受信した`resource`は監視対象allowlist(Phase Aでは`cloud_run/dev-web`等の明示設定値)に一致する場合のみ許可し、不一致はfail-closed。`incident-alerts`へのpublish権限はCloud Monitoring通知サービスエージェントのみに付与する。`incident-agent-slack` はSlack Events到達のため公開するが、§7-8の署名検証をアプリ層の必須境界とする。
10. **出力サニタイズ**: アラート受信直後、incident_key算出・DB永続化・embedding API送信より前に、`raw_alert`とembedding入力を自動マスキングする。以降も、全出力先への保存・送信前にBearer/JWT・cookie・email・接続文字列等を`[REDACTED]`へ置換する。Slack/GitHubへ出すURLは設定済みallowlist(例: `console.cloud.google.com`、対象GitHubリポジトリ、レビュー済みrunbookドメイン)だけをリンク化し、ログ・モデル出力由来の未知URLは`[LINK REMOVED]`へ置換する。Slack mrkdwn/GitHub Markdownのリンク構文もサニタイズし、表示ラベルと遷移先の不一致を許可しない。Cloud Traceには生ログ・ツール結果・プロンプトを記録しない。

## 8. 可観測性

- エージェント自身の推論トレース・ツール呼び出し・トークンコストをCloud Traceへ送出。incident-agentは`adk web`起動ではなくPub/Sub pushを受けるカスタムサービスのため、CLIフラグ(`--otel_to_cloud`)ではなくADKのtelemetryモジュールでプログラム的に設定する(`get_gcp_exporters(enable_cloud_tracing=True)` + `maybe_set_otel_providers`)。§7-10に従い、生のログ・ツール結果・プロンプトはspan属性へ記録しない。
- `ops.incidents` の `loop_count` / `token_cost` / `playbook_used`、および「受信アラート数→インシデント数→Issue数」の圧縮率をダッシュボード化。
- Slack通知にトレースリンクを添付し、推論過程を追跡可能にする。

## 9. 多層ノイズ制御フロー

原則: **アラート : インシデント : Issue = 多 : 1 : 1**。起票の手前に「アラート→インシデント」の変換層を置き、Issue数をインシデント数に収束させる。設計方針は「安い判定を上流に、高い判定を下流に置き、すり抜けた新規障害だけを最も高価なLLM調査に回す」。上流で捕まったアラートはすべて既存への集約に流れ、Issueは新規に立たない。

判定順(アラート着信 → 上から順に評価):

| 層 | 判定 | コスト | ヒット時の動作 |
| --- | --- | --- | --- |
| **L1 ハッシュ完全一致** | §9のcanonical JSONから算出した`incident_key`が未解決行(`resolved_at IS NULL AND status <> 'merged'`)と一致か | ほぼ無料 | 既存行の`alert_count`/`last_seen_at`を原子的に更新し即ACK終了。解決済みとの一致は再発として新規調査 |
| **L2 グルーピング窓** | 同一リソースの直近15分に未解決インシデント(`resolved_at IS NULL AND status <> 'merged'`)があるか | 無料 | 新規調査せず既存行へ集約。Issue作成済みならコメント、調査中ならDBの集約数へ反映 |
| **L3 ストームブレーカー** | 全体レートが閾値超か(例: 5分で10件超) | 無料 | ストームモード。個別調査を全停止し、共通属性に対し調査1回・「ストーム宣言」issue 1本・Slack 1スレッドのみ。ストーム時こそLLM調査が高コストになるため、コスト制御(§7-4)と同一スイッチ |
| **L4 embedding類似**(Phase A) | 新アラートのembeddingが直近の未解決インシデント(`resolved_at IS NULL AND status <> 'merged'`)とcos類似か(閾値超) | 中(埋込計算) | 既存行へ集約。Issue作成済みならコメント、調査中ならDBの集約数へ反映 |
| すり抜け = 新規障害 | 上記すべて非該当 | 高(LoopAgent) | §4の一次切り分け → §10で新規Issue起票 |
| (Phase B) トポロジー抑制 | `component_deps`+再帰CTEで親障害中の下流か | 低 | 子として親issueに吸収 |

### L1(ハッシュ)とL4(embedding)の違い

同じ「重複判定」でも方式が2段階ある。判定内容は「これは既存と同じ障害か」で、その精度とコストが異なる。

- **L1 ハッシュ(完全一致)**: §7-10でマスキングした後の`{"host":<host>,"message":<message>,"service":<service>,"v":1}`をキー順・空白なしのcanonical JSON(UTF-8)にし、SHA-256 hexを`incident_key`とする。入力の欠損は空文字でなく明示的な`null`として扱う。部分UNIQUEインデックスは未解決行だけを対象にするため、同じ指紋でも解決後の再発は新規インシデントとして調査する。
- **L4 embedding(意味一致)**: アラート文をベクトル化し、意味の近さ(cos類似)で判定。共通単語がほぼ無い「payment-service 5xx spike」と「payments backend HTTP 500 surge」を同一と判定できる。弱点: 埋込計算のコスト。

L1で大半を集約し、すり抜けた「表現違いの同一障害」だけをL4で捕まえる二段構え。L4はI2内部の`search_open_similar_incidents`を使い、未解決行だけを検索する。調査用toolの`search_similar_incidents`は解決済みの過去事例専用とし、両者はSQL条件を分離する。

### 同時着信時の調査オーナー確保

ノイズ制御の判定と新規調査の開始を分離すると、Issue作成前の同時アラートがすべて「既存なし」と判定して重複調査を開始する。これを防ぐため、I2は次をトランザクション内で強制する。

1. リソース単位のtransaction advisory lockを取得し、L1/L2を再チェックする。ヒット時は対象行の`alert_count`と`last_seen_at`を原子的に更新する。
2. L3判定後、L4の検索と新規行確保はL4用advisory lock内で再チェックする。類似先があればその行へ集約する。
3. すべて非該当の場合のみ、L4検索に使用したマスキング済みembeddingを含む`status='investigating'`行を**LoopAgent起動前**に挿入する。この行を作成したリクエストだけが調査オーナーとなる。embeddingを予約時に保存するため、後続の表現違いアラートは調査中でもL4にヒットする。未解決行に対する`incident_key`部分UNIQUEインデックスは最終防壁として使う。
4. 調査中の行へ後続アラートが集約された場合はIssueをまだ持たないため、DBの`alert_count`へ記録し、I4でIssue作成時に集約数を本文へ反映する。Issue作成後の集約だけコメントを追記する。
5. L4で暫定行を別インシデントへ統合する実装を採る場合は、`status='merged'`と`merged_into`を同一トランザクションで設定し、merged行を以後の類似検索対象から除外する。
6. 調査オーナーは`investigation_token`と`lease_expires_at`を持つ。leaseはCloud Run上限(300s)+再送余裕(60s)の6分とする。後続リクエストが`status='investigating'`かつ期限切れleaseを見つけたら、compare-and-swapでtoken更新・lease延長・`attempt_count + 1`し、成功した1件だけが再調査を引き継ぐ。**lease有効中の同一アラート再送は2xxで握りつぶさず5xxを返し、Pub/Sub再送をlease期限後まで維持する。** 元オーナーが完了すれば次回再送は集約済みとして2xx、クラッシュしていれば期限後に引き継ぐ。古いtokenの完了書き込みは拒否する。
7. `attempt_count=3`で再失敗した場合は、LoopAgentを再実行せず「自動調査失敗」の固定文Issue/Slack通知を作成して`status='escalated'`へ遷移する。これによりinvestigating行を永久に残さない。

## 10. Issue起票のタイミングとライフサイクル

**一次切り分け完了時に起票する**(アラート受信時ではない)。理由: ①issue本文に仮説・根拠・推奨が入った状態で生まれ、開いた瞬間にactionable ②§9の多層ノイズ制御を通過済みのためissueが荒れない ③人間承認待ちにしないことで記録漏れを防ぐ。役割分担: **GitHub Issue=記録(ストック)、Slackスレッド=対話(フロー)**。

**Issueライフサイクル**: 1インシデント=1 Issue。後続の関連アラート(L2/L4)・二次切り分けの発見(§11)は、すべて該当issueへのコメントとして積む。ストーム時(L3)はストーム宣言issueが1本のみ。

## 11. Slack対話型二次切り分け(I6)

- 一次切り分けの投稿スレッドで `@incident-agent` にメンション → app_mention イベント → 対話エンドポイント。
- **署名検証必須**: Slack Signing Secret による `X-Slack-Signature` 検証を最初のゲートとする(§7-8)。`url_verification` チャレンジは署名検証後に応答。
- **session_id = ops.incidents.id**(Vertex AI Sessions)。`team_id`+`channel`+`thread_ts`の複合キーでインシデントを照合し、そのUUIDをセッション境界にする。
- **既知かつ未解決のスレッドのみ許可**: Slack複合キーで検索し、未ヒット・Issue未紐付け・解決済み・mergedのいずれかなら調査・GitHubコメントを行わず固定応答で終了する。
- **主体allowlist**: team/channel/userの3種類を設定で明示し、すべてdefault-denyとする。通知先channelとon-callユーザーだけを許可し、workerでも再検証する。incidentのresource allowlistも再検証する。
- **Slack再送の冪等化と永続実行**: `event_id`由来の決定論的Task名を使い、Cloud Tasksへenqueue完了後にSlackへACKする。同一eventがpendingならenqueueを再試行、processing/completedならACKのみ。workerはlease+最大3回で実行し、`ops.slack_events`は完了後7日を超えた行を定期削除する。
- Slackの3秒タイムアウト対策: 即ACK→非同期処理→スレッドに返信。
- ツール・権限・予算はPhase Aと同一(読み取り専用のまま)。
- 二次切り分けで得た発見は、該当issueへコメントとして追記する。

## 12. スコープ外・非目標

- 自動緩和・自動ロールバック・本番リソースの変更(恒久)
- ページャー/オンコール管理(PagerDuty的機能)
- 対象アプリ以外の汎用監視
- Gemini Cloud Assist Investigations(Premium Support限定のため不採用)
- MCP Server の導入(Phase A/Bとも。§2参照)

## 13. AWS版との対応(設計の由来)

| AWS(参考) | GCP(本実装) |
| --- | --- |
| CloudWatch Alarm / EventBridge / Lambda | Cloud Monitoring / Pub/Sub / Cloud Run |
| AgentCore Harness(ループ基盤) | ADK LoopAgent(OSSライブラリのクラス。マネージドではない) |
| MCP→CloudWatch | function tools → Monitoring/Logging API 直呼び |
| DynamoDB(蓄積) | Cloud SQL "ops" + pgvector(類似検索) |
| 一本道パイプライン | 自己修正ループ(証拠不足なら再取得) |

## 14. インフラ前提(Terraform側)

エージェントは terraform/ を編集しないため、以下は基盤側の事前作業として切り出す:

- Pub/Sub topic `incident-alerts` + Cloud Run(`incident-agent-ingest`)へのpushサブスクリプション(OIDC認証付き。§7-9)
- `incident-alerts`の`roles/pubsub.publisher`はCloud Monitoring通知サービスエージェントのみに付与
- `incident-agent-ingest`はunauthenticated禁止。push用SAのみ `roles/run.invoker`
- Slack Events用Cloud Run `incident-agent-slack`は公開し、Slack署名検証を必須化。ingestとコード/イメージは共有するがサービス・入口・IAMを分離
- Slack追調査用Cloud Tasks queue。slack SAにqueue限定`roles/cloudtasks.enqueuer`、Task用SAにingest worker限定`roles/run.invoker`
- Cloud Monitoring アラートポリシー + 通知チャネル(Pub/Sub)
- incident-agent 用サービスアカウント(§7のIAMロール。`roles/aiplatform.user`を含む)
- incident-agent 用Cloud Run 2サービス(ingest/slack)。デプロイパイプラインはアプリと分離
- Cloud SQLに ops スキーマ用DBロール
- Slack App作成(I6用): Bot Token Scopes(app_mentions:read, chat:write)+ Events APIのリクエストURL設定
- incident-agent専用Slack App / Bot Token / Signing Secret / Webhookを作成し、Budget通知用の認証情報と共有しない。Secret Manager secretとsecretAccessor IAMもサービス単位で分離する。

## 15. 実装WBS(Phase A)

各issueは次の構造で起票する: **仕様リンク / なぜ / 受け入れ条件 / スコープ外 / ファイル境界 / 依存 / テスト**。仕様リンクは本書の該当セクション番号を使う(本書がissueの正本)。

| # | issue | 依存 | ファイル境界 | 受け入れ条件シード |
| --- | --- | --- | --- | --- |
| I1 | opsスキーマ+incidents/slack_eventsテーブル+シード事例 | なし | `services/incident-agent/db/**` | 調査token/lease/attempt、予約時embedding、Slack event/task状態を含むDDL。部分UNIQUE/制約/シード/権限分離 |
| I2 | 受け口(Pub/Sub push受信+L1〜L4ノイズ制御+自己除外+コストブレーカー) | I1, §14 | `services/incident-agent/app/**` | 完了後のみ2xx。5xx再送で期限切れleaseをCAS継承し、古いtoken書込拒否。3回失敗は固定文escalation。L1〜L4/認証/秘匿化 |
| I3 | LoopAgent+3ツール+プレイブック注入 | I2 | `services/incident-agent/agent/**`, `playbooks/**` | max_iterations=3。resource/project/filterはincident行から固定。プレイブックは固定マップ+path containment。LLM/受信値による対象・パス拡大を拒否 |
| I4 | 出力(Slack通知+GitHub Issue起票+ops保存) | I3 | `services/incident-agent/app/**` | 秘密/PIIをマスキングし、URL allowlist外のリンクを除去してSlack/Issueへ出力。予約行へ分析/Slack複合キーを保存しanalyzedへ遷移 |
| I5 | otel_to_cloud+圧縮率メトリクス(受信アラート→インシデント→Issue) | I4 | `services/incident-agent/**`(設定のみ) | Cloud Traceにマスキング済み要約/メタデータのみ送出(生ログ・ツール結果・プロンプト禁止)。圧縮率がダッシュボードで見える |
| I6 | Slack対話型二次切り分け(app_mention→session=incident UUID→追調査→スレッド返信+issueコメント追記) | I4, §14 | `services/incident-agent/app/**` | event_id+決定論的Task名。enqueue後ACK、private workerのlease+再試行。incident UUID session、未解決/default-deny/サニタイズ |

- 共通スコープ外(全issueに転記): 本番変更ツールの実装禁止 / terraform編集禁止 / アプリ(apps/web)のコード変更禁止 / 書き込み系IAMの要求禁止。
- 実行順: I1→I2→I3→I4→I5→I6 の直列(依存が一本鎖のため並列不要)。I5とI6の順は入れ替え可。
- Phase Bのissue(ポストモーテム/依存CTE/ToolConfirmation)は別途切る。
