# incident-agent

自律インシデント Agent サービス。仕様は `docs/incident-agent.md` を参照。

## I2–I3 スコープ (ingest + investigation)

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

## テスト

```bash
cd services/incident-agent
python -m pytest tests/ -q
```

統合テストは、migration 適用済みの Docker PostgreSQL を起動したうえで
`INCIDENT_AGENT_INTEGRATION=1` を設定した場合に実行されます。
