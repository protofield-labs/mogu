# incident-agent

自律インシデント Agent サービス。仕様は `docs/incident-agent.md` を参照。

## I2–I5 スコープ (ingest + investigation + outbox + observability)

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

## 可観測性 (I5)

起動時に `configure_telemetry()` が ADK `get_gcp_exporters` + `maybe_set_otel_providers`
を呼び出します。GenAI プロンプト/ツール結果は span へ記録しません
(`OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=NO_CONTENT`)。

圧縮率メトリクス:

- `incident_agent.alerts.received`
- `incident_agent.incidents.opened`
- `incident_agent.issues.opened`

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

worker:

```bash
export SERVICE_MODE=worker
export DB_USER=ops_worker DB_PASSWORD=...
export WORKER_AUDIENCE=https://worker.example
export TASK_SERVICE_ACCOUNT_EMAIL=incident-agent-task@project.iam.gserviceaccount.com
export SLACK_BOT_TOKEN=... SLACK_TEAM_ID=T... SLACK_CHANNEL_ID=C...
export GITHUB_TOKEN=... GITHUB_REPOSITORY=owner/repository
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
