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
                     │ 1. 認証・自己監視除外
                     │ 2. 無料のL1/L2候補+L3
                     │    ├─ L3 hit: 個別フローを停止
                     │    │          → embedding予算1回+代表embedding生成
                     │    │          → 調査予算1回+embedding入りstorm親を確保
                     │    │          → 共通LoopAgent調査を1回だけ実行
                     │    └─ L3非該当かつL1/L2 hit: 既存へ集約して終了
                     │ 3. 上記全miss時だけembedding予算予約 → L4
                     │    └─ L4 hit: 既存へ集約して終了
                     │ 4. L4 miss時だけ新規調査予算を予約
                     │ 5. embedding入りinvestigating行を原子的確保
                     ▼
                  ADK LoopAgent(最大3反復・確信度で早期終了)
                     ├─ playbook注入(アラート種別に対応する1枚のみ)
                     ├─ tool: get_metrics   (Cloud Monitoring API・読取)
                     ├─ tool: get_logs      (Cloud Logging API・読取)
                     └─ tool: search_similar_incidents (pgvector類似検索)
                     ▼
                  一次切り分け結果(仮説・重大度・推奨アクション・根拠・確信度)
                     ├─ Cloud SQL "ops" スキーマへ保存(マスキング済みアラート+分析+埋め込み)
                     └─ ops.outboxへSlack/GitHub出力意図を保存
                          └─ private workerが冪等送信

Slackスレッドで @incident-agent に追加質問(I6)
  → app_mention → Cloud Run service「incident-agent-slack」(公開・Slack署名必須)
  → event_id登録 + Cloud Tasks enqueue → 即ACK
  → Cloud Run service「incident-agent-worker」(非公開)で照合 → session_id = incident.id
  → 同じ読み取り専用ツールで追調査 → スレッドに返信(対話型二次切り分け)
```

### 分離の原則(別Cloud Runサービスとする理由)

**mogu本体(dev-web)とincident-agentを分離し、Agentも入口/workerの3サービスに分ける。** Agentのコードとイメージは共有し、エントリーポイントを分ける。デプロイ単位は「dev-web」「incident-agent-ingest」(Pub/Sub専用・非公開)「incident-agent-slack」(Events専用・公開)「incident-agent-worker」(Cloud Tasks専用・非公開)の4つ。

1. **ライフサイクル**: アプリは常時稼働、Agentはイベント駆動(発火時のみ起動→終了)。
2. **障害の独立性**: 監視する側が監視される側と同居すると、アプリ障害時にAgentも停止する。分離により「アプリが落ちてもAgentは切り分けを継続」が成立。
3. **権限分離**: Agent専用サービスアカウントに最小権限(§7)。アプリのSAには監視系権限を付与しない。
4. **入口の分離**: Pub/Subはingest、Slack Eventsはslack、非同期処理はworkerへ分ける。共有イメージでも各entrypointは担当HTTP routeだけを登録し、ingest routeをslack/workerへ、Slack Events routeをingest/workerへ、Task routeをingest/slackへ一切mountしない。cross-routeはbody処理前に404とする。workerはCloud Tasks用SAだけがinvokeでき、外部向けルートを持たない。

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
  incident_kind  text NOT NULL DEFAULT 'normal'
    CHECK (incident_kind IN ('normal', 'storm')),
  storm_key      text,                   -- L3のみ。5分bucket+共通属性のcanonical JSONをSHA-256
  alert_policy   text NOT NULL,
  resource       text NOT NULL,          -- 例: cloud_run/dev-web
  severity       text,                   -- agent判定: critical/high/medium/low。調査前はNULL
  raw_alert      jsonb NOT NULL,         -- §7-10でマスキング済み。原文は保存しない
  rca_hypothesis text,                   -- 仮説・根拠・推奨・確信度
  rca_reviewed   boolean NOT NULL DEFAULT false,
  reviewed_at    timestamptz,
  reviewed_by    text,
  playbook_used  text,                   -- 使用したプレイブック名
  loop_count     int NOT NULL DEFAULT 0, -- 実反復回数
  token_cost     numeric,                -- 1調査の推定コスト
  status         text NOT NULL DEFAULT 'investigating'
    CHECK (status IN ('investigating', 'analyzed', 'escalated', 'resolved', 'merged')),
  alert_count    int NOT NULL DEFAULT 1 CHECK (alert_count > 0),
  last_seen_at   timestamptz NOT NULL DEFAULT now(),
  merged_into    uuid REFERENCES ops.incidents(id),
  investigation_token uuid NOT NULL DEFAULT gen_random_uuid(),
  lease_expires_at timestamptz NOT NULL DEFAULT (now() + interval '600 seconds'),
  attempt_count  int NOT NULL DEFAULT 1 CHECK (attempt_count BETWEEN 1 AND 3),
  github_issue   text,
  slack_team     text,
  slack_channel  text,
  slack_thread   text,                   -- thread_ts。I6のsession_idはincidentのidを使う
  embedding      vector(768),            -- 通常調査は必須。embedding失敗escalationのみNULL
  embedding_unavailable boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  resolved_at    timestamptz,
  CHECK ((status = 'resolved') = (resolved_at IS NOT NULL)),
  CHECK ((status = 'merged') = (merged_into IS NOT NULL)),
  CHECK ((incident_kind = 'storm') = (storm_key IS NOT NULL)),
  CHECK (embedding IS NOT NULL OR embedding_unavailable OR status = 'merged'),
  CHECK (NOT embedding_unavailable OR embedding IS NULL),
  CHECK (NOT embedding_unavailable OR status IN ('escalated', 'resolved', 'merged'))
);
CREATE INDEX ON ops.incidents USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON ops.incidents (created_at DESC);
CREATE UNIQUE INDEX incidents_open_incident_key
  ON ops.incidents (incident_key)
  WHERE resolved_at IS NULL AND status <> 'merged';
CREATE INDEX ON ops.incidents (resource, alert_policy, last_seen_at DESC)
  WHERE resolved_at IS NULL AND status <> 'merged';
CREATE UNIQUE INDEX incidents_open_storm_key
  ON ops.incidents (storm_key)
  WHERE resolved_at IS NULL AND status <> 'merged' AND storm_key IS NOT NULL;
CREATE UNIQUE INDEX incidents_open_storm_scope
  ON ops.incidents (resource, alert_policy)
  WHERE resolved_at IS NULL AND status <> 'merged' AND incident_kind = 'storm';
CREATE UNIQUE INDEX incidents_open_slack_thread
  ON ops.incidents (slack_team, slack_channel, slack_thread)
  WHERE resolved_at IS NULL
    AND status <> 'merged'
    AND slack_team IS NOT NULL
    AND slack_channel IS NOT NULL
    AND slack_thread IS NOT NULL;

CREATE TABLE ops.alert_deliveries (
  message_id  text PRIMARY KEY,          -- Pub/Sub message.messageId
  resource    text NOT NULL,
  alert_policy text NOT NULL,
  incident_key text NOT NULL,
  sanitized_alert jsonb NOT NULL,
  incident_id uuid REFERENCES ops.incidents(id),
  is_owner    boolean NOT NULL DEFAULT false,
  status      text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'embedding', 'processing', 'completed')),
  work_token  uuid NOT NULL DEFAULT gen_random_uuid(),
  work_lease_expires_at timestamptz,
  embedding_reserved boolean NOT NULL DEFAULT false,
  embedding_attempt_count int NOT NULL DEFAULT 0
    CHECK (embedding_attempt_count BETWEEN 0 AND 3),
  embedding vector(768),
  received_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX ON ops.alert_deliveries (incident_id, received_at);
CREATE INDEX ON ops.alert_deliveries (resource, alert_policy, received_at);

CREATE TABLE ops.slack_events (
  event_id    text PRIMARY KEY,
  task_name   text NOT NULL UNIQUE,
  incident_id uuid REFERENCES ops.incidents(id),
  team_id     text NOT NULL,
  channel_id  text NOT NULL,
  thread_ts   text NOT NULL,
  user_id     text NOT NULL,
  status      text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempt_count int NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 3),
  lease_expires_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX ON ops.slack_events (received_at);

CREATE TABLE ops.outbox (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     uuid NOT NULL REFERENCES ops.incidents(id),
  destination     text NOT NULL
    CHECK (destination IN ('slack', 'github_issue', 'github_comment', 'github_close')),
  idempotency_key text NOT NULL UNIQUE,
  payload         jsonb NOT NULL,         -- §7-10サニタイズ済み
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempt_count   int NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 10),
  lease_expires_at timestamptz,
  external_ref    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz
);
CREATE INDEX ON ops.outbox (status, created_at);

CREATE TABLE ops.budget_usage (
  usage_date          date PRIMARY KEY,
  embedding_count     int NOT NULL DEFAULT 0 CHECK (embedding_count >= 0),
  investigation_count int NOT NULL DEFAULT 0 CHECK (investigation_count >= 0),
  token_cost          numeric NOT NULL DEFAULT 0 CHECK (token_cost >= 0)
);

-- Phase B:
-- CREATE TABLE ops.postmortems (...);
-- CREATE TABLE ops.component_deps (from_c text, to_c text);  -- 再帰CTE用
```

`ops.budget_usage`の予約は共通DBプリミティブにする。各予約transactionでUTC当日の行を`INSERT ... ON CONFLICT (usage_date) DO NOTHING`により遅延作成し、その行を`SELECT ... FOR UPDATE`して上限確認とcounter加算を同時に行う。日付行が存在しないことを予算超過として扱わず、embedding/I6/通常調査のすべてがこの処理だけを使う。

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
| `get_logs` | Cloud Logging API(entries.list) | `ops.incidents.resource`へサーバー側で固定・`timestamp >= now()-60m`・severity>=WARNING・最大200行。時間下限をサーバー側で必ずfilterへ付与。出力は§7-10のマスキングを経由 |
| `search_similar_incidents` | 人間レビュー済みの解決事例をpgvector cos類似検索し、過去の原因を調査根拠にする | `status='resolved' AND rca_reviewed=true AND rca_hypothesis IS NOT NULL`・上位3件 |

`get_metrics` / `get_logs` のresource・project・filterは、認証済みリクエストに対応する`ops.incidents`行からサーバー側で決定論的に構築する。LLMやSlackユーザーが指定したresource/project/filterは拒否または無視し、他サービスへのクエリ拡大を許可しない。

L4の重複排除はLLM toolではなく、I2内部の決定論的DB関数`search_open_similar_incidents`として実装する。検索条件を新アラートと同一`resource`+`alert_policy`かつ`resolved_at IS NULL AND status <> 'merged' AND embedding IS NOT NULL`に固定する。過去事例を探す`search_similar_incidents`とは同じembedding/query helperを共有してよいが、用途別のSQL条件を混在させない。

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
  - pgvectorへの還流(保存は自動・検索昇格は人間承認): 新規インシデントはI2予約時から未解決重複排除の母集団に入る。解決時にRCAを人間が確認して`rca_reviewed=true`、`reviewed_by`、`reviewed_at`を設定した事例だけが、過去事例toolの母集団へ昇格する。検索結果はマスキング済み要約+発生日+Issue URLだけを返し、生ログや未レビューRCAを再注入しない。
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

1. **読み取り専用をIAMで強制**: AgentのSAには `roles/monitoring.viewer` / `roles/logging.viewer` / `roles/cloudtrace.agent`(Trace送出のみ) / `roles/aiplatform.user`(LoopAgent・embedding・Vertex AI Sessions実行)とopsスキーマDBロールを付与する。Slack送信は専用Bot Tokenの`chat:write`だけを使い、Incoming Webhookは使わない。GitHub fine-grained tokenは対象リポジトリ1つに限定し、`Issues: Read and write`(Issue作成+コメント/close)と必須のMetadata read以外(Contents/Actions等)を付与しない。本番リソースへの書き込み系・デプロイ系ロールは一切付与しない。
2. **自己監視の除外**: アラート対象が `incident-agent` 自身なら調査せず固定文通知のみ。アラートポリシー側でも除外(二重防御)。自己言及ループの遮断。
3. **多層ノイズ制御**: §9参照。Issue数をインシデント数に収束させる。
4. **コストサーキットブレーカー**: ingestとSlack workerは`ops.budget_usage`を共有する。通常経路はL1/L2/L3非該当後、L3 storm経路は代表embedding生成前に`embedding_count`を予約する。`investigation_count`は、通常経路ではL4非該当後、L3 storm経路では新規storm親確保前に予約し、どちらも予約成功後だけLoopAgentを呼ぶ。全予約は共通DBプリミティブにより行ロック下で原子的に行い、各日次上限と1調査トークン上限を強制する。予約失敗時は高価な処理を呼ばずfail-closed。I6は`investigation_count`を共有し、incident排他+user/thread時間レートも適用する。
5. **ログはデータとして扱う**: ログ本文内の指示には従わない旨をシステムプロンプトに明記。書き込み権限がない(1.)ことで実害を構造遮断。
6. **タイムアウトと再試行**: ingestとCloud Tasks workerのCloud Run request timeoutは600秒、Pub/Sub push ack deadlineも600秒とする。アプリはrequest受信時に`request_started_at+540秒`の絶対deadlineを作り、認証・マスキング・L1〜L4・embedding・DB待機を含む全処理で共有する。LoopAgentへ渡す残時間は`min(270秒, absolute_deadline-now()-30秒)`とし、最後の30秒を結果/outboxの同一transaction永続化と応答に必ず残す。このLoopAgent実行枠が尽きたら、最大3反復の途中でも打ち切る。開始時点で残時間がない、または実行中にdeadlineへ到達した場合は高価な処理を開始/継続せず、token一致CASでleaseを即時失効させ5xxを返す。owner leaseは600秒とし、プロセスクラッシュ時はleaseが先に切れるまで再送が待つため並行ownerを作らない。分析結果とoutboxのcommit後だけ2xxを返し、Cloud Run強制終了とPub/Sub再送判断より最低60秒早く応答を確定する。公開Slack Events routeは3秒以内のenqueue+ACKを維持する。外部APIはCloud Tasks workerがidempotency key+leaseで送信する。
7. **本番不変**: 環境を変更するツールを持たせない。緩和は推奨としてissueに書くだけ。実行は人間(Phase BでもToolConfirmationによる人間承認を必須とする)。
8. **Slack対話(I6)の追加ガード**: 署名+5分timestampを検証後、`event_id`と決定論的Cloud Tasks名を原子的に登録し、Task enqueue後だけ200 ACKする。workerはlease+最大3回で処理する。許可主体は設定値`ALLOWED_SLACK_TEAM_IDS` / `ALLOWED_SLACK_CHANNEL_IDS` / `ALLOWED_SLACK_USER_IDS`の3つすべてに一致する場合のみとし、未設定・空・不一致は拒否する。channel allowlistは一次通知先と一致させ、user allowlistはon-call/運用担当だけを登録する。workerはSlack複合キー、未解決状態、GitHub Issue、3 allowlist、incidentのresource allowlistを実行直前に再検証する。
9. **受信エンドポイントの認証**: `incident-agent-ingest` はunauthenticated禁止。Pub/Sub pushはOIDC JWTの署名・issuer・audience(ingestのCloud Run URL)を検証し、push用SAのみ `run.invoker`。受信した`resource`は監視対象allowlistに一致する場合のみ許可し、不一致はfail-closed。`incident-alerts`へのpublish権限はCloud Monitoring通知サービスエージェントのみに付与する。公開`incident-agent-slack`は§7-8の署名検証を必須境界とする。非公開`incident-agent-worker`もIAMだけに依存せず、全Task routeでCloud Tasks OIDC JWTの署名・issuer・audience(worker URL)・有効期限・Task用SA identityをアプリ層で検証し、不一致はbody処理前に拒否する。
10. **出力サニタイズ**: アラート受信直後、incident_key算出・DB永続化・embedding API送信より前に、`raw_alert`とembedding入力を自動マスキングする。JSONは許可フィールドだけを再帰処理し、未知フィールドを出力へ引き継がない。ログは行単位でBearer/JWT・cookie・email・接続文字列等を`[REDACTED]`へ置換する。以降も全保存・送信前に同処理を適用する。Slackのログ由来/LLM生成本文はBlock Kit `plain_text`で送り、`<`/`>`/`&`や`<!here>`/`<@U...>`/`<#C...>`をmrkdwnとして解釈させない。リンクが必要な箇所だけ別要素でallowlist検証済みURLとescape済みlabelから構築する。GitHub MarkdownもHTML/mention/link制御文字をescapeし、未知URLは`[LINK REMOVED]`、表示ラベルと遷移先の不一致は禁止する。Cloud Traceには生ログ・ツール結果・プロンプトを記録しない。マスキング例外・必須フィールドの処理不能・出力検証失敗は必ずfail-closedとする。受信時なら生入力を破棄し、`messageId/resource/alert_policy/masking_error=true`だけの固定安全JSONからfallback incident_keyを算出して`embedding_unavailable=true,status='escalated'`行+定数だけの固定outboxへ収束させ、embedding/LoopAgentを呼ばない。ツール/Session/outbox段階なら当該内容を保存・送信せずincidentをescalatedへ遷移し、同じ固定outboxだけを使う。
11. **サービス別secret/IAM分離**: 共有イメージへsecretを焼き込まず、Cloud Run実行SA・Secret Manager `secretAccessor`・Cloud SQL DB roleを3サービス別にする。ingestは`ops_ingest` DB role+Monitoring/Logging/Vertex権限だけで、Slack Bot/GitHub/Signing Secretを持たない。公開slackはSigning Secret+queue限定enqueuer+`ops_slack_ingress` role(`slack_events`の必要最小操作のみ)とし、Bot/GitHub token、Vertex/Monitoring/Logging権限、他ops表の更新権限を持たない。workerだけが`ops_worker` role、Bot Token、GitHub token、I6用Monitoring/Logging/Vertex権限を持ち、Signing Secretを持たない。デプロイ後に各SAから非許可secret参照と非許可DB操作が拒否されることを検証する。

## 8. 可観測性

- エージェント自身の推論トレース・ツール呼び出し・トークンコストをCloud Traceへ送出。incident-agentは`adk web`起動ではなくPub/Sub pushを受けるカスタムサービスのため、CLIフラグ(`--otel_to_cloud`)ではなくADKのtelemetryモジュールでプログラム的に設定する(`get_gcp_exporters(enable_cloud_tracing=True)` + `maybe_set_otel_providers`)。§7-10に従い、生のログ・ツール結果・プロンプトはspan属性へ記録しない。
- `ops.incidents` の `loop_count` / `token_cost` / `playbook_used`、および「受信アラート数→インシデント数→Issue数」の圧縮率をダッシュボード化。
- Slack通知にトレースリンクを添付し、推論過程を追跡可能にする。

## 9. 多層ノイズ制御フロー

原則: **アラート : インシデント : Issue = 多 : 1 : 1**。起票の手前に「アラート→インシデント」の変換層を置き、Issue数をインシデント数に収束させる。設計方針は「安い判定を上流に、高い判定を下流に置き、すり抜けた新規障害だけを最も高価なLLM調査に回す」。上流で捕まったアラートはすべて既存への集約に流れ、Issueは新規に立たない。

集約の確定順(アラート着信 → 上から順に確定)。L1/L2候補のDB検索はL3 rate計算と同じlock内で先に実行してよいが、L3非該当が確定するまで候補へ集約しない:

| 層 | 判定 | コスト | ヒット時の動作 |
| --- | --- | --- | --- |
| **L3 ストームブレーカー** | 同一resource+alert_policyのレートが閾値超か(例: 5分で10件超) | 無料 | L1/L2候補への集約を確定する前に評価。個別調査を停止し、共通調査1回・storm issue 1本へ統合 |
| **L1 ハッシュ完全一致** | Pub/Sub `messageId`を冪等化後、canonical JSONの`incident_key`が未解決行と一致か | ほぼ無料 | 別messageIdは1回だけ集約して2xx。同じowner messageIdの再送だけをlease回復へ回す。解決済みとの一致は再発として新規調査 |
| **L2 グルーピング窓** | 同一resource+alert_policyの直近15分に未解決インシデント(`resolved_at IS NULL AND status <> 'merged'`)があるか | 無料 | investigatingは件数へ反映。analyzed/escalatedはIssue参照の有無にかかわらず依存付きcomment outboxを作成 |
| **L4 embedding類似**(Phase A) | 同一resource+alert_policyの未解決・embedding有りincidentとcos類似か(閾値超) | 中(埋込計算) | L2と同じ集約処理。新規調査・Issueは作らない |
| すり抜け = 新規障害 | 上記すべて非該当 | 高(LoopAgent) | §4の一次切り分け → §10で新規Issue起票 |
| (Phase B) トポロジー抑制 | `component_deps`+再帰CTEで親障害中の下流か | 低 | 子として親issueに吸収 |

### 受信JSONの正規化allowlist

Cloud Monitoring payloadをそのまま`raw_alert`へ残さず、対応する通知schema versionごとに固定adapterを実装し、次の内部schemaだけを生成する。入力pathは`incident.policy_name`、`incident.resource_name`、`incident.resource.type`、`incident.resource.labels.{project_id,location,region,zone,service_name,service,host,instance_name,instance_id}`、`incident.summary`、`incident.condition_name`、`incident.incident_id`、`incident.state`、`incident.started_at`だけを許可し、それ以外のtop-level/nested fieldは再帰的に破棄する。

- `alert_policy`: `incident.policy_name`を設定済みpolicy allowlistの正規値へ変換(必須)
- `resource`: `incident.resource_name`または`resource.type`+識別用labelsを、設定済みresource allowlistの正規値へ変換(必須)
- `service`: `resource.labels.service_name`→`resource.labels.service`の順。無ければ`null`
- `host`: `resource.labels.host`→`instance_name`→`instance_id`の順。無ければ`null`
- `message`: マスキング済み`incident.summary`。無ければ`null`
- `condition` / `source_incident_id` / `source_state` / `started_at`: 対応する上記pathを型・長さ検証後に格納。無ければ`null`
- `v`: 内部schema versionの整数`1`

`sanitized_alert`/`raw_alert`はこの内部schemaと完全一致させ、L1はその`host/message/resource/service`だけから算出する。embedding/LoopAgentにもこの内部schemaだけを渡す。対応外schema version、必須値の欠落、型/長さ違反、resource/policy allowlist不一致、adapter例外は§7-10のマスキング失敗経路へfail-closedする。adapterの各許可path・優先順位・未知field破棄をfixtureで固定し、Monitoring payload変更でL1 fieldが無言で`null`化しないよう契約テストする。

### L1(ハッシュ)とL4(embedding)の違い

同じ「重複判定」でも方式が2段階ある。判定内容は「これは既存と同じ障害か」で、その精度とコストが異なる。

- **L1 ハッシュ(完全一致)**: §7-10でマスキングした後の`{"host":<host>,"message":<message>,"resource":<resource>,"service":<service>,"v":1}`をキー順・空白なしのcanonical JSON(UTF-8)にし、SHA-256 hexを`incident_key`とする。`resource`は§7-9のallowlist検証済み正規値を使う。入力の欠損は空文字でなく明示的な`null`として扱う。別resourceは必ず別指紋となり、解決後の同一指紋は新規インシデントとして調査する。
- **L4 embedding(意味一致)**: アラート文をベクトル化し、意味の近さ(cos類似)で判定。共通単語がほぼ無い「payment-service 5xx spike」と「payments backend HTTP 500 surge」を同一と判定できる。弱点: 埋込計算のコスト。

L1で大半を集約し、すり抜けた「表現違いの同一障害」だけをL4で捕まえる二段構え。L4はI2内部の`search_open_similar_incidents`を使い、未解決行だけを検索する。調査用toolの`search_similar_incidents`は解決済みの過去事例専用とし、両者はSQL条件を分離する。

### 同時着信時の調査オーナー確保

ノイズ制御の判定と新規調査の開始を分離すると、Issue作成前の同時アラートがすべて「既存なし」と判定して重複調査を開始する。これを防ぐため、I2はDB状態遷移を短いトランザクションとadvisory lockで強制する(API呼び出し中にDB transactionを保持しない)。

1. 認証・resource allowlist・alert_policy正規化・messageId形式検証後、**マスキング前に**messageIdを冪等化する。新規deliveryは生入力を含まない`sanitized_alert={"masking_pending":true}`と安全metadata由来fallback `incident_key`で`received`挿入する。既存messageIdはpayloadを再解釈せずDB状態へ従う。新規行だけマスキングし、成功時はtoken一致CASで実incident_key/sanitized_alertへ更新する。失敗時は§7-10の安全escalated incident+固定outbox作成とdelivery completedを同一transactionで行い、再送はcompletedとして2xxに収束する。
2. リソース単位のtransaction advisory lock内で、まず同一resource+alert_policyの未解決storm行を時間窓なしで検索し、ヒット時は手順7で集約する。非該当時は、(a)`resolved_at IS NULL AND status <> 'merged'`のL1 key完全一致、(b)同一resource+alert_policyかつ`last_seen_at >= now()-15m`の未解決normal行を候補にする。L2が複数なら`last_seen_at DESC, created_at DESC, id ASC`の先頭だけを使う。まだ集約せずL3を評価し、**L3 hitは必ず手順3へ進む**。L3非該当時だけ**L1(a)→L2(b)**の最初へ手順7で集約し、候補なしなら手順4へ進む。`embedding_unavailable=true`だけを理由にscope全体へ集約せず、後続の別keyアラートは通常フローでembedding回復・新規調査を再試行できるようにする。
3. L3閾値に達したらL1/L2候補への個別集約を行わず、通常フローから**排他的にストーム分岐**する。`{"alert_policy":<正規化値>,"bucket_start":<UTCの5分境界>,"kind":"storm","resource":<allowlist検証済み値>,"v":1}`をキー順・空白なしのcanonical JSONにしてSHA-256 hexの`storm_key`を作り、`incident_key`にも同じ値を使う。`storm_key`でadvisory lockを取得し、`incidents_open_storm_key`/`incidents_open_storm_scope`でもストーム行を一意にする。既存行へは集約して終了する。新規時は手順4と同じdelivery checkpointで代表アラートのembeddingを生成し(API中はlockを保持しない)、完了後にlockを再取得して既存ストーム行を再確認する。なお非該当なら同transactionで調査予算予約、deliveryのembeddingをコピーした`incident_kind='storm'`行、delivery ownerを確保し、同じ新UUIDを両token、同じ600秒期限を両leaseへ設定する。同時に、同一resource+alert_policyの未解決normal行を`status='merged'`/`merged_into=<storm id>`へ更新し、token/lease/ownerを失効させる。Issue既存行にはstorm Issue ref確定後に送る統合コメントと`github_close` outboxを各1件作り、workerはコメント成功後だけcloseする。これらをcommitしてから共通調査を開始する。予算/API失敗は手順6へ収束する。L3ヒット後はL4検索・個別行作成へ進まない。
4. L1〜L3非該当時、deliveryのembeddingが既にあればAPIを再実行せず直ちに手順5へ進む。未保存の場合、短いtransactionで`embedding_reserved=false`なら`embedding_count`予約と`embedding_reserved=true`更新を同時に1回だけ行う。その後、予約済みか否かにかかわらずembedding未保存かつ試行可能なdeliveryだけを`status='embedding'`、attempt+1、新work_token、60秒leaseへCAS更新してAPIを呼ぶ。API成功時はtoken一致条件でembedding保存+`received`へ戻し、次の実行は手順5へ進む。クラッシュ時はlease後にtokenを再発行してAPIだけ再試行し、`embedding_reserved`をfalseへ戻さず予算を二重計上しない。
5. deliveryにembeddingが保存された後、手順2と同じresource advisory lockを再取得する。最初にopen stormを時間窓なしで再検索し、hitなら手順7へ進む。非該当時だけ手順2と同じL1→L2候補順・L2 tie-break・L3優先を再実行する。L3 hitは手順3、L3非該当かつ候補ありは手順7へ進む。候補なしの場合だけL4検索を行い、同率なら`cosine_similarity DESC, last_seen_at DESC, id ASC`の先頭へ集約する。L4 missはlockを保持したまま調査予算予約、deliveryのembeddingをコピーしたincident挿入、同じ新UUIDをincident `investigation_token`とdelivery `work_token`へ設定し、両leaseを同じ600秒期限にしてowner processingまで原子的に行う。
6. embedding予算超過、embedding API 3回失敗、または調査予算超過時はLoopAgentを呼ばない。`status='escalated'`のincident+固定文outbox+delivery completedを同一transactionで作り、必ず記録・通知経路へ収束させる。L3経由では、この親incidentへ`incident_kind='storm'`、手順3で算出した`storm_key`、`incident_key=storm_key`、取得済みならdeliveryのembeddingを設定し、同じ親UUIDへnormal行をmerged化する。token失効・owner completed・統合コメント+`github_close` outboxも手順3と同様に行い、失敗経路でもopen storm scopeとopen Issue 1本を保つ。embedding取得不能時だけ`embedding=NULL, embedding_unavailable=true`とし、このフラグは後の`resolved`遷移でも保持する。調査予算超過時は取得済みembeddingを保存する。
7. 手順2/3/5のすべての別messageId集約は共通関数を使う。investigatingはcount/last_seenだけ更新する。analyzed/escalatedはcount/last_seen更新とmessageId付き`github_comment` outbox作成を原子的に行い、Issue ref未設定ならpendingで待つ。delivery completedも同じtransactionに含める。
8. ownerのtoken/leaseはincidentとdeliveryへ同じ値をmirrorする。absolute deadlineはrequest開始から540秒、各LoopAgent実行枠は残時間内で最大270秒、leaseは600秒。期限切れかつincident `attempt_count < 3`なら、両方の旧token一致をCAS条件に新UUIDを両tokenへ設定し、両leaseを同じ期限へ延長し、incident attempt+1を同一transactionで行う。片方だけの更新は禁止し、古いtokenの書き込みを拒否する。attempt=3なら加算せず手順9を同じCAS transactionで実行する。
9. 成功時は分析+outbox+analyzed+delivery completedを同一transactionで保存する。3回目の調査失敗または3回目のlease失効時も、`attempt_count=3`のまま固定文outbox+escalated+delivery completedを原子的に保存し、CHECK上限を超える更新を行わない。

## 10. Issue起票のタイミングとライフサイクル

**一次切り分け完了時に起票する**(アラート受信時ではない)。理由: ①issue本文に仮説・根拠・推奨が入った状態で生まれ、開いた瞬間にactionable ②§9の多層ノイズ制御を通過済みのためissueが荒れない ③人間承認待ちにしないことで記録漏れを防ぐ。役割分担: **GitHub Issue=記録(ストック)、Slackスレッド=対話(フロー)**。

**Issueライフサイクル**: 1インシデント=1 Issue。後続の関連アラート(L2/L4)・二次切り分けの発見(§11)は、すべて該当issueへのコメントとして積む。ストーム時(L3)はストーム宣言issueが1本のみ。

**外部出力のoutbox**: Slack/GitHub書き込みは`ops.outbox`を経由する。Task bodyは`outbox.id`だけを識別子として受け、workerはdestination/payload/incident/idempotency_keyを必ずDB行から再読込する。bodyの追加fieldやDB不一致は拒否し、DB行を唯一の正本としてlease+idempotency keyで送信する。Slack一次投稿はIncoming Webhookでなく専用Bot Tokenの`chat.postMessage`を使い、成功レスポンスの`channel`と`ts`を`incidents.slack_channel/slack_thread`へ保存し、設定済みteam IDを`slack_team`へ保存する。GitHub Issue成功時はoutbox `external_ref`と`incidents.github_issue`を同一transactionで保存する。I6は4フィールドがすべて揃うまでfail-closed。失敗は最大10回再試行後`failed`として運用アラートを出す。

**failed outboxの回復**: 原因修正後、運用者専用CLI `replay_outbox <outbox UUID>`で`status='failed'`行だけを`pending`、`attempt_count=0`、`lease_expires_at=NULL`へCAS更新できるようにする。destination/payload/idempotency_keyは変更不可とし、同じidempotency keyで再送する。CLIはops operator用DB資格情報を使い、AgentランタイムSA・公開エンドポイントから呼べないようにする。Slack成功/GitHub失敗などの部分成功時も、欠けたoutboxだけを再実行してincident参照を補完し、4参照が揃うまでI6は拒否を続ける。

**解決・RCAレビュー**: GitHub Issueを閉じただけでは過去事例検索へ昇格しない。運用者が専用CLI `review_incident` にincident UUID・最終RCA要約・reviewer IDを明示して実行し、同一トランザクションで`status='resolved'` / `resolved_at` / `rca_reviewed=true` / `reviewed_at` / `reviewed_by`を更新する。CLIはops reviewer用DB資格情報を使い、AgentランタイムSAや公開エンドポイントから呼べないようにする。未レビューの解決事例は保存されるが`search_similar_incidents`から除外する。

## 11. Slack対話型二次切り分け(I6)

- 一次切り分けの投稿スレッドで `@incident-agent` にメンション → app_mention イベント → 対話エンドポイント。
- **署名検証必須**: Slack Signing Secret による `X-Slack-Signature` 検証を最初のゲートとする(§7-8)。`url_verification` チャレンジは署名検証後に応答。
- **session_id = ops.incidents.id**(Vertex AI Sessions)。`team_id`+`channel`+`thread_ts`の複合キーでインシデントを照合し、そのUUIDをセッション境界にする。
- **LLM入力の投稿者制限**: 起点の`app_mention`本文は署名・3 allowlist検証済み`user_id`のものだけを使う。スレッド履歴を取得する場合も、`ALLOWED_SLACK_USER_IDS`に含まれる投稿者とincident-agent Bot自身のサニタイズ済み返信だけを時系列文脈へ含め、それ以外のユーザー投稿・添付・リンク展開は無視する。Vertex AI Sessionへもこのフィルタ後の文脈だけを保存する。
- **Session保存境界**: 許可ユーザー本文を含むSession入出力の全テキストへ、Vertex AI Sessionへの書き込み前とモデルへの再読込前の両方で§7-10のマスキングを適用する。解決済みincidentのSessionは`resolved_at`から30日後に削除し、削除失敗を運用アラート化する。
- **既知かつ未解決のスレッドのみ許可**: Slack複合キーで検索し、未ヒット・Issue未紐付け・解決済み・mergedのいずれかなら調査・GitHubコメントを行わず固定応答で終了する。
- **主体allowlist**: team/channel/userの3種類を設定で明示し、すべてdefault-denyとする。通知先channelとon-callユーザーだけを許可し、workerでも再検証する。incidentのresource allowlistも再検証する。
- **Slack再送の冪等化と永続実行**: `event_id`由来の決定論的Task名を使い、Cloud Tasksへenqueue完了後にSlackへACKする。同一eventがpendingならenqueueを再試行、processing/completedならACKのみ。workerはlease+最大3回で実行し、`ops.slack_events`は完了後7日を超えた行を定期削除する。
- **Task bodyを信頼しない**: Slack Taskは`event_id`だけを識別子として受け、workerはteam/channel/thread/user/incident_id/task_nameを`ops.slack_events`から再読込する。bodyの追加field・決定的Task名との不一致・DB未登録eventはfail-closedとし、認可判断へbody値を使わない。
- **共有予算と排他**: workerはLLM実行直前にingestと同じ`ops.budget_usage`を原子的に予約する。incident単位で1件だけ実行し、user+threadごとの時間レートも検査する。上限超過時は調査せず固定応答する。
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

- Pub/Sub topic `incident-alerts` + Cloud Run(`incident-agent-ingest`)へのpushサブスクリプション(OIDC認証付き、ack deadline 600秒。§7-9)
- `incident-alerts`の`roles/pubsub.publisher`はCloud Monitoring通知サービスエージェントのみに付与
- `incident-agent-ingest`はunauthenticated禁止。push用SAのみ `roles/run.invoker`
- Slack Events用Cloud Run `incident-agent-slack`は公開し、Slack署名検証を必須化。ingestとコード/イメージは共有するがサービス・入口・IAMを分離
- 共有イメージの各entrypointは担当routeだけを登録する。slack URL上のingest/Task path、ingest URL上のSlack/Task path、worker URL上のingest/Slack pathが404になるデプロイ後テストを必須化
- Slack追調査用Cloud Tasks queue。slack SAにqueue限定`roles/cloudtasks.enqueuer`
- Slack/GitHub outbox配信用Cloud Tasks queue(または別routing)
- Task用SAだけが非公開`incident-agent-worker`をinvoke。ingest/slackサービスへのTask送信は禁止
- worker全Task routeでCloud Tasks OIDC JWTをアプリ層検証し、Task用SA identity/audience/issuer/expiryをデプロイ後に検証
- Cloud Monitoring アラートポリシー + 通知チャネル(Pub/Sub)
- incident-agent 用Cloud Run実行SAをingest/slack/worker別に作成し、§7-11のIAM/secret allowlistを適用
- incident-agent 用Cloud Run 3サービス(ingest/slack/worker)。共有イメージ・別entrypoint、デプロイパイプラインはアプリと分離
- Cloud SQLに`ops_ingest`/`ops_slack_ingress`/`ops_worker`のサービス別DB roleを作成し、slack ingressは`slack_events`必要最小操作だけに限定
- Slack App作成(I6用): Bot Token Scopes(app_mentions:read, chat:write)+ Events APIのリクエストURL設定
- incident-agent専用Slack App / Bot Token / Signing Secretを作成し、Incoming Webhookは作成・使用しない。Budget通知用の認証情報と共有せず、Secret Manager secretとsecretAccessor IAMもサービス単位で分離する。

## 15. 実装WBS(Phase A)

各issueは次の構造で起票する: **仕様リンク / なぜ / 受け入れ条件 / スコープ外 / ファイル境界 / 依存 / テスト**。仕様リンクは本書の該当セクション番号を使う(本書がissueの正本)。

| # | issue | 依存 | ファイル境界 | 受け入れ条件シード |
| --- | --- | --- | --- | --- |
| I1 | opsスキーマ+incidents/alert_deliveries/slack_events/outbox/budget_usage | なし | `services/incident-agent/db/**` | 全制約/outbox/budget予約、ops_ingest/slack_ingress/worker最小DB role |
| I2 | 受け口(Pub/Sub push受信+L1〜L4ノイズ制御+自己除外+コストブレーカー) | I1, §14 | `services/incident-agent/app/**` | ops_ingest role。Slack/GitHub secret禁止。placeholder冪等化、二相判定、token/lease原子更新 |
| I3 | LoopAgent+3ツール+プレイブック注入 | I2 | `services/incident-agent/agent/**`, `playbooks/**` | reviewed事例のみ。resource/60分固定、playbook containment。ツールマスク失敗は内容破棄+固定escalation |
| I4 | outbox出力(Slack+GitHub)+RCAレビュー/failed replay CLI | I3, §14 | `services/incident-agent/app/**`, `services/incident-agent/scripts/**` | secretはworkerのみ。chat.postMessage channel/ts保存。worker OIDC/DB正本、storm close、replay |
| I5 | otel_to_cloud+圧縮率メトリクス(受信アラート→インシデント→Issue) | I4 | `services/incident-agent/**`(設定のみ) | Cloud Traceにマスキング済み要約/メタデータのみ送出(生ログ・ツール結果・プロンプト禁止)。圧縮率がダッシュボードで見える |
| I6 | Slack対話型二次切り分け(app_mention→session=incident UUID→追調査→スレッド返信+issueコメント追記) | I4, §14 | `services/incident-agent/app/**` | 公開slackはSigning+最小DB/queueのみ。worker OIDC/DB正本、Session mask+TTL、予算/排他/rate |

- 共通スコープ外(全issueに転記): 本番変更ツールの実装禁止 / terraform編集禁止 / アプリ(apps/web)のコード変更禁止 / 書き込み系IAMの要求禁止。
- 実行順: I1→I2→I3→I4→I5→I6 の直列(依存が一本鎖のため並列不要)。I5とI6の順は入れ替え可。
- Phase Bのissue(ポストモーテム/依存CTE/ToolConfirmation)は別途切る。
