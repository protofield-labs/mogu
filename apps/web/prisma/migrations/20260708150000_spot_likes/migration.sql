-- Spot likes for feed empathy (#212).

CREATE TABLE "spot_likes" (
    "user_id" TEXT NOT NULL,
    "spot_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spot_likes_pkey" PRIMARY KEY ("user_id","spot_id"),
    CONSTRAINT "spot_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("firebase_uid") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "spot_likes_spot_id_fkey" FOREIGN KEY ("spot_id") REFERENCES "spots"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_spot_likes_spot" ON "spot_likes"("spot_id");

ALTER TABLE "spot_likes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "spot_likes" FORCE ROW LEVEL SECURITY;

CREATE POLICY "spot_likes_select" ON "spot_likes"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "spots" s
      WHERE s."id" = "spot_likes"."spot_id"
        AND (
          s."added_by" = app_current_user()
          OR EXISTS (
            SELECT 1 FROM "collections" c
            WHERE c."id" = s."collection_id"
              AND (
                c."owner_id" = app_current_user()
                OR (
                  c."visibility" = 'friends'
                  AND are_friends(c."owner_id", app_current_user())
                )
              )
          )
        )
    )
  );

CREATE POLICY "spot_likes_insert" ON "spot_likes"
  FOR INSERT WITH CHECK (
    "user_id" = app_current_user()
    AND EXISTS (
      SELECT 1 FROM "spots" s
      WHERE s."id" = "spot_id"
        AND (
          s."added_by" = app_current_user()
          OR EXISTS (
            SELECT 1 FROM "collections" c
            WHERE c."id" = s."collection_id"
              AND (
                c."owner_id" = app_current_user()
                OR (
                  c."visibility" = 'friends'
                  AND are_friends(c."owner_id", app_current_user())
                )
              )
          )
        )
    )
  );

CREATE POLICY "spot_likes_delete" ON "spot_likes"
  FOR DELETE USING ("user_id" = app_current_user());
