-- Agent consultation history (#153).

CREATE TABLE "agent_consultations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "vertex_session_id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "entries" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_consultations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "agent_consultations_vertex_session_id_key" UNIQUE ("vertex_session_id"),
    CONSTRAINT "agent_consultations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("firebase_uid") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_agent_consultations_user_updated"
  ON "agent_consultations"("user_id", "updated_at" DESC);

ALTER TABLE "agent_consultations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_consultations" FORCE ROW LEVEL SECURITY;

CREATE POLICY "agent_consultations_select_self" ON "agent_consultations"
  FOR SELECT USING ("user_id" = app_current_user());
CREATE POLICY "agent_consultations_insert_self" ON "agent_consultations"
  FOR INSERT WITH CHECK ("user_id" = app_current_user());
CREATE POLICY "agent_consultations_update_self" ON "agent_consultations"
  FOR UPDATE USING ("user_id" = app_current_user())
             WITH CHECK ("user_id" = app_current_user());
CREATE POLICY "agent_consultations_delete_self" ON "agent_consultations"
  FOR DELETE USING ("user_id" = app_current_user());
