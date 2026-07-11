# incident-agent

自律インシデント Agent サービス。仕様は `docs/incident-agent.md` を参照。

## I2 スコープ (ingest)

- Pub/Sub push 受信 (`/pubsub/alerts`)
- OIDC JWT 検証
- Monitoring payload adapter → 内部 canonical schema v1
- マスキング / incident_key / storm_key
- L1–L4 ノイズ制御 + storm merge
- embedding / investigation 予算予約
- owner token/lease CAS (`save_owner_analysis` は I3 向け)

## 起動

```bash
export SERVICE_MODE=ingest
export INGEST_SKIP_AUTH=true   # ローカル開発のみ
export DB_HOST=localhost DB_NAME=mogu DB_USER=ops_ingest DB_PASSWORD=...
export ALLOWED_RESOURCES=cloud_run/dev-web
export ALLOWED_ALERT_POLICIES=dev-web-latency
export EMBEDDING_BACKEND=deterministic # ローカル開発のみ。本番はvertex固定
uvicorn app.main:app --host 0.0.0.0 --port 8080
```

## テスト

```bash
cd services/incident-agent
python -m pytest tests/ -q
```

統合テストは、migration 適用済みの Docker PostgreSQL を起動したうえで
`INCIDENT_AGENT_INTEGRATION=1` を設定した場合に実行されます。
