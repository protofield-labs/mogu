-- Issue #28: align users RLS with docs/erd-api.md §2
-- Public SELECT for friend search; INSERT/UPDATE restricted to self.

-- Bulk backfill must bypass RLS (app_user cannot UPDATE other users' rows).
ALTER TABLE "users" DISABLE ROW LEVEL SECURITY;

UPDATE "users" SET "avatar_color" = '#888888' WHERE "avatar_color" IS NULL;

ALTER TABLE "users" ALTER COLUMN "avatar_color" SET DEFAULT '#888888';
ALTER TABLE "users" ALTER COLUMN "avatar_color" SET NOT NULL;

DROP POLICY IF EXISTS "self_only" ON "users";

CREATE POLICY "users_select_public" ON "users"
  FOR SELECT USING (true);

CREATE POLICY "users_insert_self" ON "users"
  FOR INSERT WITH CHECK ("firebase_uid" = app_current_user());

CREATE POLICY "users_update_self" ON "users"
  FOR UPDATE USING ("firebase_uid" = app_current_user())
             WITH CHECK ("firebase_uid" = app_current_user());

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
