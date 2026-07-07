-- Cross-instance agent SSE relay (#66).

CREATE TABLE "agent_session_events" (
    "id" BIGSERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "vertex_session_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "event_timestamp" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_session_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "agent_session_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("firebase_uid") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_agent_session_events_session_id"
  ON "agent_session_events"("user_id", "vertex_session_id", "id");

ALTER TABLE "agent_session_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_session_events" FORCE ROW LEVEL SECURITY;

CREATE POLICY "agent_session_events_select_self" ON "agent_session_events"
  FOR SELECT USING ("user_id" = app_current_user());
CREATE POLICY "agent_session_events_insert_self" ON "agent_session_events"
  FOR INSERT WITH CHECK ("user_id" = app_current_user());
