# incident-agent

自律インシデント Agent サービス。仕様は `docs/incident-agent.md` を参照。

## I2–I6 スコープ (ingest + investigation + outbox + observability + Slack対話)

- Pub/Sub push 受信 (`/pubsub/alerts`)
- OIDC JWT 検証
- Monitoring payload adapter → 内部 canonical schema v1
- マスキング / incident_key / storm_key
- L1–L4 ノイズ制御 + storm merge
- embedding / investigation 予算予約
- owner token/lease CAS と分析結果の原子的保存
- ADK `LoopAgent` (investigator → evaluator、最大3周、高確信度で早期終了)
- incident DB 行へ固定した Monitoring / Logging / reviewed類似事例ツール
- alert policy固定mapによるプレイブック1枚の注入
- tool/model/Session境界の共通secret scannerとfail-closed escalation
- 1分scanのoutbox dispatcher（pending/期限切れsending、依存sentのみ、決定論的Cloud Task名）
- OIDC認証workerによるSlack/GitHub冪等送信、lease+delivery token
- failed outbox replay / 人間RCAレビューCLI
- ADK telemetry のプログラム設定（Cloud Trace + 圧縮率メトリクス）
- Slack/GitHub 通知への Cloud Trace リンク添付
- Slack対話型二次切り分け（I6）: 公開 `/slack/events` ingress + `/tasks/slack` worker

## Slack対話型二次切り分け (I6)

公開 `incident-agent-slack` サービス（`SERVICE_MODE=slack`）が `/slack/events` を受け、
非公開 worker（`SERVICE_MODE=worker`）の `/tasks/slack` が Cloud Tasks 経由で追調査を実行します。

ingress 側（すべて DB 登録 / Task 作成より前・default-deny。§7-8, §7-12）:

- raw body 256 KiB 上限を `Content-Length` と streaming read の双方で強制
  （JSON parse / 署名計算 / DB より前に拒否）
- Slack Signing Secret による `X-Slack-Signature` v0 検証 + 5分 timestamp 窓
- `url_verification` チャレンジは署名検証後に応答
- `ALLOWED_SLACK_TEAM_IDS` / `ALLOWED_SLACK_CHANNEL_IDS` / `ALLOWED_SLACK_USER_IDS`
  の3 allowlist（未設定・空・不一致は固定 200 ACK のみ）。DM チャネル(D...)は形式で拒否
- `team+channel+user` の advisory lock 下で user 単位1分レートを原子的に確認
  （`SLACK_USER_RATE_LIMIT_PER_MINUTE` 未設定/不正値は default-deny）
- `event_id` 冪等化 + 決定論的 Task 名 `slack-<event_id>`。Task enqueue 後だけ 200 ACK

worker 側（DB 正本。§11）:

- Task body は `event_id` のみ受理（追加 field は 400）。task 名不一致・DB 未登録 event は fail-closed
- Slack 複合キー（`slack_team+slack_channel+slack_thread`）で未解決 incident を照合し、
  GitHub Issue / issue outbox 未紐付け・解決済み・merged は固定応答で終了
- 3 allowlist / incident resource allowlist を実行直前に再検証
- incident 単位で同時1件（advisory lock で claim を直列化）、user+thread の
  時間レート、ingest と共有する `ops.budget_usage` の調査予算予約
  （超過は固定応答。同一 event の再試行は初回の予約を再利用し二重課金しない）
- スレッド履歴は allowlist ユーザーと Bot 自身の発言のみを LLM 文脈へ含め、
  Session 書き込み前 / モデル再読込前に secret scanner を適用（失敗は fail-closed）
- session_id = incident UUID（`SESSION_BACKEND=vertex` で Vertex AI Sessions、
  既定はプロセス内 in-memory）
- スレッド返信は plain_text Block + 決定論的 `client_msg_id`。発見は
  `github_comment` outbox（`depends_on`=issue outbox）として event 完了と同一 transaction で保存
- lease + 最大3回試行（3回失敗時は固定の失敗通知をスレッドへ best-effort 送信）。
  retention Job が完了後7日超の `slack_events` 行と解決後30日超の Session を削除
  （削除失敗は counter metric + 非0終了）

インフラ前提（§7-12 / §14, Terraform I0）: 外部 Application Load Balancer +
serverless NEG + Cloud Armor（署名前 per-IP / 全体 rate）経由のみを許可し、
Cloud Run ingress は `internal-and-cloud-load-balancing` で直接インターネット到達を拒否。
`channels:history` / `groups:history` は通知先 channel 種別の一方のみ付与し、
`im:history` / `mpim:history` は付与しない。

## 可観測性 (I5)

起動時に `configure_telemetry()` が ADK `get_gcp_exporters` + `maybe_set_otel_providers`
を呼び出します。GenAI プロンプト/ツール結果は span へ記録しません
(`OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=NO_CONTENT`)。

圧縮率メトリクス:

- `incident_agent.alerts.received`
- `incident_agent.incidents.opened`
- `incident_agent.issues.opened`

I6 用カウンタ（IDや本文を含まない安全なcounterのみ）:

- `incident_agent.slack.denied`（reason: signature/malformed/allowlist/rate_limited/unsupported）
- `incident_agent.slack.followups.completed`
- `incident_agent.slack.session_cleanup.failed`

ダッシュボード用 MQL 例は `observability/dashboard.md` を参照。

環境変数:

- `ENABLE_CLOUD_TRACING` (default: true)
- `ENABLE_CLOUD_METRICS` (default: true)

## 起動

```bash
export SERVICE_MODE=ingest
export INGEST_SKIP_AUTH=true   # ローカル開発のみ
export DB_HOST=localhost DB_NAME=mogu DB_USER=ops_ingest DB_PASSWORD=...
export ALLOWED_RESOURCES=cloud_run/dev-web
export ALLOWED_ALERT_POLICIES=dev-web-latency
export EMBEDDING_BACKEND=deterministic # ローカル開発のみ。本番はvertex固定
export GOOGLE_CLOUD_PROJECT=...         # LoopAgent / Monitoring / Logging
export INCIDENT_AGENT_MODEL=gemini-2.5-flash
uvicorn app.main:app --host 0.0.0.0 --port 8080
```

slack ingress（公開・LB/Armor経由のみ）:

```bash
export SERVICE_MODE=slack
export DB_USER=ops_slack_ingress DB_PASSWORD=...
export SLACK_SIGNING_SECRET=...
export ALLOWED_SLACK_TEAM_IDS=T...
export ALLOWED_SLACK_CHANNEL_IDS=C...
export ALLOWED_SLACK_USER_IDS=U...,U...
export SLACK_USER_RATE_LIMIT_PER_MINUTE=5   # 未設定はdefault-deny
export SLACK_QUEUE_PROJECT=... SLACK_QUEUE_LOCATION=asia-northeast1
export SLACK_QUEUE_NAME=incident-agent-slack
export WORKER_URL=https://worker.example
export WORKER_AUDIENCE=https://worker.example
export TASK_SERVICE_ACCOUNT_EMAIL=incident-agent-task@project.iam.gserviceaccount.com
uvicorn app.main:app --host 0.0.0.0 --port 8080
```

worker:

```bash
export SERVICE_MODE=worker
export DB_USER=ops_worker DB_PASSWORD=...
export WORKER_AUDIENCE=https://worker.example
export TASK_SERVICE_ACCOUNT_EMAIL=incident-agent-task@project.iam.gserviceaccount.com
export SLACK_BOT_TOKEN=... SLACK_TEAM_ID=T... SLACK_CHANNEL_ID=C...
export GITHUB_TOKEN=... GITHUB_REPOSITORY=owner/repository
# I6 追調査用
export ALLOWED_SLACK_TEAM_IDS=T...
export ALLOWED_SLACK_CHANNEL_IDS=C...
export ALLOWED_SLACK_USER_IDS=U...,U...
export SLACK_THREAD_RATE_LIMIT_PER_HOUR=10  # 未設定はdefault-deny
export SESSION_BACKEND=vertex               # 既定はinmemory
export VERTEX_AGENT_ENGINE_ID=...           # vertex時のみ
uvicorn app.main:app --host 0.0.0.0 --port 8080
```

dispatcher Job（Cloud Schedulerから1分ごとに起動）:

```bash
export DB_USER=ops_dispatcher DB_PASSWORD=...
export OUTBOX_QUEUE_PROJECT=... OUTBOX_QUEUE_LOCATION=asia-northeast1
export OUTBOX_QUEUE_NAME=incident-agent-outbox
export WORKER_URL=https://worker.example
export WORKER_AUDIENCE=https://worker.example
export TASK_SERVICE_ACCOUNT_EMAIL=incident-agent-task@project.iam.gserviceaccount.com
python -m jobs.outbox_dispatcher
```

Slack retention Job（1日1回。slack_events 7日 / Session 30日）:

```bash
export DB_USER=ops_worker DB_PASSWORD=...
export SLACK_EVENTS_RETENTION_DAYS=7 SESSION_RETENTION_DAYS=30
python -m jobs.slack_retention
```

運用者専用CLI（Agentランタイムとは別のDB資格情報を使用）:

```bash
export DB_USER=ops_operator DB_PASSWORD=...
python -m scripts.replay_outbox <outbox-uuid>
export DB_USER=ops_reviewer DB_PASSWORD=...
python -m scripts.review_incident <incident-uuid> \
  --rca "Final reviewed root cause" --reviewer "oncall@example.com"
```

## テスト

```bash
cd services/incident-agent
python -m pytest tests/ -q
```

統合テストは、migration 適用済みの Docker PostgreSQL を起動したうえで
`INCIDENT_AGENT_INTEGRATION=1` を設定した場合に実行されます。

## デプロイ

本番イメージは `services/incident-agent/Dockerfile` でビルドします（開発用の
`requirements.txt` / `pytest` は含みません）。

```bash
cd services/incident-agent
docker build -t incident-agent:local .
```

`main` へマージされると `.github/workflows/deploy-incident-agent.yml` が
`asia-northeast1-docker.pkg.dev/mogu-501309/incident-agent/incident-agent`
へ push します。Terraform で `enable_incident_agent = true` かつ
`incident_agent_image` を設定済みの場合、既存の Cloud Run 3サービスと
outbox / ops-migrate / slack-retention Job も同じタグへ更新されます
（未作成時は push のみ）。

`services/incident-agent/db/migrations/` に変更があると、デプロイ前に
`dev-incident-agent-ops-migrate` Job が実行されます（Job 未作成時は skip）。

初回は `terraform/environments/dev/terraform.tfvars.example` の手順どおり、
イメージ公開後に `enable_incident_agent = true` を apply し、続けて
ops migrate Job を手動または CI で実行してください。
