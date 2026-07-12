# incident-agent dev 有効化 Runbook

`docs/incident-agent.md` §14 の運用手順。Terraform とアプリデプロイが揃ったあと、dev で一次調査・I6 を動かすためのチェックリスト。

## 前提

- `enable_db_connection = true`（Cloud SQL 接続済み）
- `services/incident-agent/` の CI が green（`.github/workflows/incident-agent-check.yml`）
- Artifact Registry リポジトリ `incident-agent` は runtime より先に通常の Terraform apply で作成される
- I6 の Vertex Session を使う場合は **`enable_external_apis = true` かつ `enable_agent_engine = true`**（web の orchestrator を流用）、または `incident_agent_vertex_agent_engine_id` を明示

## 1. Artifact Registry を bootstrap する

初回だけ、`enable_incident_agent = false` のまま Terraform を apply し、
Artifact Registry リポジトリ `incident-agent` を先に作成する。

```bash
cd terraform/environments/dev
terraform apply
```

## 2. イメージを publish する

main マージ後、デプロイ workflow がイメージを push する:

```text
asia-northeast1-docker.pkg.dev/mogu-501309/incident-agent/incident-agent:<git-sha>
```

手動の場合:

```bash
gh workflow run deploy-incident-agent.yml
```

## 3. terraform.tfvars を設定する

`terraform/environments/dev/terraform.tfvars.example` を参考に、最低限以下を設定する。

| 変数 | 説明 |
| --- | --- |
| `enable_incident_agent` | `true` |
| `incident_agent_image` | 上記 Artifact Registry のタグ（存在するイメージ必須） |
| `incident_agent_slack_bot_token` | 専用 Slack App の Bot Token |
| `incident_agent_slack_team_id` / `channel_id` | 通知先 workspace / channel |
| `incident_agent_slack_allowed_user_ids` | I6 追調査を許可するユーザー ID（カンマ区切り） |
| `incident_agent_github_token` | Issue 操作用 fine-grained token |
| `incident_agent_allowed_resources` | ingest allowlist（例: `cloud_run/dev-web`。`//run.googleapis.com/...` URI は不可） |
| `incident_agent_slack_domain` + `signing_secret` | 外部 LB 経由の Events API 用（本番相当） |

`incident_agent_allowed_alert_policies` を空にすると、Terraform 既定の `dev-incident-agent-cloud-run-5xx` / `-latency` が ingest に渡される。

`incident_agent_allowed_resources` には adapter が照合する正規化形式を使う（`services/incident-agent/app/adapter.py` の `_normalize_resource` 参照）。dev の Monitoring ポリシーが監視する `dev-web` なら `cloud_run/dev-web` が最短。Pub/Sub 通知の `resource_name` がそのまま届く場合もある。

## 4. terraform apply

```bash
cd terraform/environments/dev
terraform apply
```

apply 後の主要 output:

- `incident_agent_ingest_url` — Pub/Sub push 先（内部のみ）
- `incident_agent_slack_lb_ip` — Slack Events 用 LB IP（domain 設定時）
- `incident_agent_session_backend` — `vertex` または `inmemory`

## 5. ops DB migration

初回または `db/migrations/` 変更後:

**A. GitHub Actions（推奨）**

```bash
gh workflow run deploy-incident-agent.yml -f run_ops_migrations=true
```

**B. gcloud（手動）**

```bash
gcloud run jobs execute dev-incident-agent-ops-migrate \
  --region=asia-northeast1 --project=mogu-501309 --wait
```

## 6. Slack App（I6）

1. 専用 Slack App を作成（Budget 通知 App と分離）
2. Bot Token Scopes: `app_mentions:read`, `chat:write`、通知 channel が public なら `channels:history`、private なら `groups:history`
3. Events API: `app_mention` を subscribe
4. Request URL: `https://<incident_agent_slack_domain>/slack/events`（LB + 証明書が有効なこと）
5. Bot を通知 channel に invite
6. `terraform.tfvars` の allowlist（team / channel / user）と一致させる

## 7. Monitoring → ingest 経路の確認

- アラートポリシー `dev-incident-agent-cloud-run-*` が Pub/Sub topic `incident-alerts` に通知する設定になっていること（`monitoring.tf`）
- ingest の `ALLOWED_RESOURCES` / `ALLOWED_ALERT_POLICIES` が実際の監視対象と一致していること

## 8. デプロイ後スモーク（§14）

各サービスで担当 route のみ 200/404 が期待どおりか確認する（共有イメージ・別 `SERVICE_MODE`）。

| サービス | 到達すべき path | 404 である path |
| --- | --- | --- |
| ingest | `POST /pubsub/alerts` | `/slack/events`, worker Task paths |
| slack | `POST /slack/events` | `/pubsub/alerts`, worker Task paths |
| worker | Cloud Tasks 宛先 | ingest / slack の公開 path |

内部からのヘルス確認例（ingest は internal-only のため VPC / 認証付き invoke が必要）:

```bash
gcloud run services describe dev-incident-agent-ingest \
  --region=asia-northeast1 --project=mogu-501309 --format='value(status.url)'
```

## 9. トラブルシュート

| 症状 | 確認ポイント |
| --- | --- |
| Pub/Sub push 401/403 | ingest の `PUBSUB_AUDIENCE` / push SA と subscription OIDC 設定 |
| アラートが default-deny | `ALLOWED_RESOURCES` / `ALLOWED_ALERT_POLICIES` の CSV と Monitoring の resource / policy 名 |
| I6 が常に拒否 | allowlist 3種、`slack_events` テーブル、incident の 4 参照（Slack thread + GitHub issue） |
| Session 削除が動かない | `incident_agent_session_backend=vertex` と `VERTEX_AGENT_ENGINE_ID`（output / Cloud Run env） |
| outbox が送られない | Scheduler → `dev-incident-agent-outbox-dispatcher` Job、dispatcher の Cloud Tasks enqueue ログ |

## 関連

- 仕様: `docs/incident-agent.md`
- アプリ README: `services/incident-agent/README.md`
- デプロイ workflow: `.github/workflows/deploy-incident-agent.yml`
