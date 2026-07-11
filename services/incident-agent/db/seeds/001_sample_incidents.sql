-- I1 seed: resolved + rca_reviewed incidents for pgvector similarity search testing
-- search_similar_incidents filters: status='resolved' AND rca_reviewed=true AND rca_hypothesis IS NOT NULL

-- Deterministic 768-dim vectors: first 16 dimensions carry cluster signal, rest near zero.
CREATE OR REPLACE FUNCTION ops._seed_vector(cluster_offset int, cluster_strength float8 DEFAULT 0.9)
RETURNS vector(768)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (
    '[' || string_agg(
      CASE
        WHEN i BETWEEN cluster_offset AND cluster_offset + 15 THEN cluster_strength::text
        ELSE '0.001'
      END,
      ','
    ) || ']'
  )::vector(768)
  FROM generate_series(1, 768) AS i;
$$;

-- Latency cluster (similar embeddings at offset 1 and 3)
INSERT INTO ops.incidents (
  id,
  incident_key,
  alert_policy,
  resource,
  severity,
  raw_alert,
  rca_hypothesis,
  rca_reviewed,
  reviewed_at,
  reviewed_by,
  playbook_used,
  loop_count,
  status,
  alert_count,
  github_issue,
  embedding,
  resolved_at
) VALUES
(
  'a1000000-0000-4000-8000-000000000001',
  'seed-latency-p99-2026-01-10',
  'cloud_run_latency',
  'cloud_run/dev-web',
  'high',
  '{"v":1,"alert_policy":"cloud_run_latency","resource":"cloud_run/dev-web","service":"dev-web","host":null,"message":"p99 latency spike on revision dev-web-00042","condition":"response-latency-p99","source_incident_id":"mon-001","source_state":"open","started_at":"2026-01-10T08:15:00Z"}'::jsonb,
  'Revision dev-web-00042 デプロイ直後のコールドスタート増加が主因。接続プール枯渇は副次要因。',
  true,
  '2026-01-10T12:00:00Z',
  'oncall@example.com',
  'cloud_run_latency.md',
  2,
  'resolved',
  1,
  'https://github.com/protofield-labs/mogu/issues/9001',
  ops._seed_vector(1),
  '2026-01-10T12:00:00Z'
),
(
  'a1000000-0000-4000-8000-000000000002',
  'seed-latency-p99-2026-02-05',
  'cloud_run_latency',
  'cloud_run/dev-web',
  'medium',
  '{"v":1,"alert_policy":"cloud_run_latency","resource":"cloud_run/dev-web","service":"dev-web","host":null,"message":"HTTP 5xx correlated with elevated p99 on dev-web","condition":"response-latency-p99","source_incident_id":"mon-002","source_state":"open","started_at":"2026-02-05T14:30:00Z"}'::jsonb,
  '前回(2026-01-10)と同型のコールドスタート問題。新リビジョン dev-web-00058 へのトラフィックシフト直後に再発。',
  true,
  '2026-02-05T18:00:00Z',
  'oncall@example.com',
  'cloud_run_latency.md',
  1,
  'resolved',
  1,
  'https://github.com/protofield-labs/mogu/issues/9015',
  ops._seed_vector(3),
  '2026-02-05T18:00:00Z'
),
-- Dissimilar: Cloud SQL connections cluster (offset 64)
(
  'a1000000-0000-4000-8000-000000000003',
  'seed-sql-connections-2026-03-01',
  'cloud_sql_connections',
  'cloud_sql/dev-db',
  'critical',
  '{"v":1,"alert_policy":"cloud_sql_connections","resource":"cloud_sql/dev-db","service":null,"host":"dev-db","message":"Cloud SQL connection count exceeded threshold","condition":"cloudsql-connections","source_incident_id":"mon-003","source_state":"open","started_at":"2026-03-01T03:00:00Z"}'::jsonb,
  'アプリ側コネクションプール max_connections 設定過大。Cloud SQL インスタンス上限に到達。',
  true,
  '2026-03-01T06:30:00Z',
  'dba@example.com',
  'cloud_sql_connections.md',
  3,
  'resolved',
  1,
  'https://github.com/protofield-labs/mogu/issues/9030',
  ops._seed_vector(64),
  '2026-03-01T06:30:00Z'
);

-- Sample outbox rows demonstrating depends_on / dispatch_generation (not dispatched)
INSERT INTO ops.outbox (
  id,
  incident_id,
  destination,
  idempotency_key,
  depends_on,
  dispatch_generation,
  payload,
  status
) VALUES
(
  'b2000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'github_issue',
  'seed:github_issue:9001',
  NULL,
  0,
  '{"title":"[seed] Cloud Run p99 latency","body":"Seed incident for vector search tests."}'::jsonb,
  'sent'
),
(
  'b2000000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000001',
  'github_comment',
  'seed:github_comment:9001:followup',
  'b2000000-0000-4000-8000-000000000001',
  0,
  '{"body":"Follow-up comment depends on issue outbox."}'::jsonb,
  'pending'
);

-- Drop seed-only helper (not granted to runtime roles)
DROP FUNCTION ops._seed_vector(int, float8);
