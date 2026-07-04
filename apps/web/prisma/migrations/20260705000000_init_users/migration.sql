-- CreateTable
CREATE TABLE "users" (
    "firebase_uid" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "avatar_color" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("firebase_uid")
);

-- RLS (#16): app_user runs migrations and is the application connection user.
-- FORCE ROW LEVEL SECURITY keeps policies effective for the table owner.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;

CREATE POLICY "self_only" ON "users"
  FOR ALL
  USING ("firebase_uid" = current_setting('app.current_user_id', true))
  WITH CHECK ("firebase_uid" = current_setting('app.current_user_id', true));
