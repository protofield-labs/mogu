-- I6 (docs/incident-agent.md §11): the retention job runs with the worker
-- component role and must purge slack_events rows older than 7 days after
-- completion. No other component gains DELETE on ops tables.

GRANT DELETE ON ops.slack_events TO ops_worker;

-- §7-4: one Slack follow-up event charges the shared investigation budget at
-- most once, even across Cloud Tasks retries after transient failures.
ALTER TABLE ops.slack_events
  ADD COLUMN IF NOT EXISTS budget_reserved boolean NOT NULL DEFAULT false;
