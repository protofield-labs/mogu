-- I1: ops schema — extension, tables, indexes, constraints
-- Spec: docs/incident-agent.md §3, §9-10

CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS ops;

CREATE TABLE ops.incidents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_key   text NOT NULL,
  incident_kind  text NOT NULL DEFAULT 'normal'
    CHECK (incident_kind IN ('normal', 'storm')),
  storm_key      text,
  alert_policy   text NOT NULL,
  resource       text NOT NULL,
  severity       text,
  raw_alert      jsonb NOT NULL,
  rca_hypothesis text,
  rca_reviewed   boolean NOT NULL DEFAULT false,
  reviewed_at    timestamptz,
  reviewed_by    text,
  playbook_used  text,
  loop_count     int NOT NULL DEFAULT 0,
  token_cost     numeric,
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
  slack_thread   text,
  embedding      vector(768),
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

CREATE INDEX incidents_embedding_hnsw
  ON ops.incidents USING hnsw (embedding vector_cosine_ops);

CREATE INDEX incidents_created_at_desc
  ON ops.incidents (created_at DESC);

CREATE UNIQUE INDEX incidents_open_incident_key
  ON ops.incidents (incident_key)
  WHERE resolved_at IS NULL AND status <> 'merged';

CREATE INDEX incidents_open_resource_policy_last_seen
  ON ops.incidents (resource, alert_policy, last_seen_at DESC)
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
  message_id  text PRIMARY KEY,
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

CREATE INDEX alert_deliveries_incident_received
  ON ops.alert_deliveries (incident_id, received_at);

CREATE INDEX alert_deliveries_resource_policy_received
  ON ops.alert_deliveries (resource, alert_policy, received_at);

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

CREATE INDEX slack_events_received_at
  ON ops.slack_events (received_at);

CREATE TABLE ops.outbox (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     uuid NOT NULL REFERENCES ops.incidents(id),
  destination     text NOT NULL
    CHECK (destination IN ('slack', 'github_issue', 'github_comment', 'github_close')),
  idempotency_key text NOT NULL UNIQUE,
  depends_on      uuid REFERENCES ops.outbox(id),
  dispatch_generation int NOT NULL DEFAULT 0 CHECK (dispatch_generation >= 0),
  payload         jsonb NOT NULL,
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempt_count   int NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 10),
  lease_expires_at timestamptz,
  delivery_token  uuid NOT NULL DEFAULT gen_random_uuid(),
  external_ref    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz,
  CHECK (destination NOT IN ('github_comment', 'github_close') OR depends_on IS NOT NULL)
);

CREATE INDEX outbox_status_created_at
  ON ops.outbox (status, created_at);

CREATE INDEX outbox_depends_on
  ON ops.outbox (depends_on);

CREATE TABLE ops.budget_usage (
  usage_date          date PRIMARY KEY,
  embedding_count     int NOT NULL DEFAULT 0 CHECK (embedding_count >= 0),
  investigation_count int NOT NULL DEFAULT 0 CHECK (investigation_count >= 0),
  token_cost          numeric NOT NULL DEFAULT 0 CHECK (token_cost >= 0)
);

-- Phase B placeholders (not created in I1):
-- ops.postmortems, ops.component_deps
