# incident-agent DB (ops schema)

Cloud SQL 上の `ops` スキーマ定義。仕様の正本は `docs/incident-agent.md` §3, §7-11, §15 I1。

## 構成

| パス | 内容 |
| --- | --- |
| `migrations/001_ops_schema.sql` | pgvector 拡張、スキーマ、5 テーブル、索引・CHECK |
| `migrations/002_budget_primitives.sql` | 日次予算の遅延行作成 + `FOR UPDATE` 予約関数 |
| `migrations/003_ops_roles.sql` | 4 component 用 DB ロールと最小権限 GRANT |
| `migrations/004_incident_review_gate.sql` | ingest/worker による RCA レビュー列の DB ゲート |
| `migrations/005_outbox_delivery_token.sql` | delivery token + `ops_operator` replay / `ops_reviewer` RCA権限 |
| `seeds/001_sample_incidents.sql` | pgvector 類似検索テスト用の解決済み事例 |
| `validate.sh` | Docker + pgvector でマイグレーション適用と構造検証 |

## 適用順

先に I0 Terraform を apply し、パスワード付き LOGIN ユーザー
`ops_ingest` / `ops_slack_ingress` / `ops_worker` / `ops_dispatcher` を作成する。
`003_ops_roles.sql` は Terraform と所有権が競合しないようロールを作成せず、
必要なruntime 4ユーザーに加え、I4の`ops_operator` / `ops_reviewer`をTerraformで作成する。

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/001_ops_schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/002_budget_primitives.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/003_ops_roles.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/004_incident_review_gate.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/005_outbox_delivery_token.sql
# 開発・検証のみ
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f seeds/001_sample_incidents.sql
```

ローカル検証: `./validate.sh`

## DB ロール (§7-11)

| ロール | 用途 | 権限概要 |
| --- | --- | --- |
| `ops_ingest` | Pub/Sub ingest | incidents / alert_deliveries / outbox / budget_usage の DML（最小） |
| `ops_slack_ingress` | Slack Events ingress | `slack_events` のみ |
| `ops_worker` | Cloud Tasks worker | incidents / outbox / slack_events / budget_usage の更新系 |
| `ops_dispatcher` | outbox dispatcher Job | eligible 判定用の `outbox` SELECT のみ |
| `ops_operator` | operator専用outbox replay CLI | outboxのreplay列のみ |
| `ops_reviewer` | operator専用RCAレビューCLI | incidentsのレビュー・解決列のみ |

各ロールは他テーブルへの INSERT/UPDATE/DELETE を持たない。`ops_dispatcher` は SELECT のみ。

## 予算プリミティブ (§3)

`ops.reserve_embedding_budget(max)` / `ops.reserve_investigation_budget(max)` は `SECURITY DEFINER` で UTC 当日行を遅延作成し、`SELECT ... FOR UPDATE` で上限確認とカウンタ加算を行う。`ops_ingest` / `ops_worker` は `budget_usage` への直接 DML 権限を持たず、関数 `EXECUTE` のみ。
