-- Core product schema (#27). Source: docs/erd-api.md §2
-- users table + RLS from 20260705000000_init_users is unchanged (#28 will adjust users RLS).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "rating" AS ENUM ('again', 'either', 'no');
CREATE TYPE "collection_visibility" AS ENUM ('friends', 'secret');
CREATE TYPE "friendship_status" AS ENUM ('pending', 'accepted');

CREATE OR REPLACE FUNCTION app_current_user() RETURNS text
  LANGUAGE sql STABLE AS
$$ SELECT current_setting('app.current_user_id', true) $$;

CREATE TABLE "friendships" (
    "user_low" TEXT NOT NULL,
    "user_high" TEXT NOT NULL,
    "status" "friendship_status" NOT NULL DEFAULT 'pending',
    "requested_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMPTZ(6),

    CONSTRAINT "friendships_pkey" PRIMARY KEY ("user_low","user_high"),
    CONSTRAINT "friendships_user_low_fkey" FOREIGN KEY ("user_low") REFERENCES "users"("firebase_uid") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "friendships_user_high_fkey" FOREIGN KEY ("user_high") REFERENCES "users"("firebase_uid") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "friendships_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("firebase_uid") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "friendships_user_low_user_high_check" CHECK ("user_low" < "user_high")
);

CREATE OR REPLACE FUNCTION are_friends(a text, b text) RETURNS boolean
  LANGUAGE sql STABLE AS
$$
  SELECT EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.status = 'accepted'
      AND f.user_low  = LEAST(a, b)
      AND f.user_high = GREATEST(a, b)
  )
$$;

ALTER TABLE "friendships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "friendships" FORCE ROW LEVEL SECURITY;

CREATE POLICY "friendships_select" ON "friendships"
  FOR SELECT USING ("user_low" = app_current_user() OR "user_high" = app_current_user());
CREATE POLICY "friendships_insert" ON "friendships"
  FOR INSERT WITH CHECK (
    "requested_by" = app_current_user()
    AND ("user_low" = app_current_user() OR "user_high" = app_current_user())
  );
CREATE POLICY "friendships_update" ON "friendships"
  FOR UPDATE USING ("user_low" = app_current_user() OR "user_high" = app_current_user())
             WITH CHECK ("user_low" = app_current_user() OR "user_high" = app_current_user());

CREATE TABLE "collections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cover_url" TEXT,
    "visibility" "collection_visibility" NOT NULL DEFAULT 'friends',
    "theme" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "collections_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("firebase_uid") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "collections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "collections" FORCE ROW LEVEL SECURITY;

CREATE POLICY "collections_select" ON "collections"
  FOR SELECT USING (
    "owner_id" = app_current_user()
    OR ("visibility" = 'friends' AND are_friends("owner_id", app_current_user()))
  );
CREATE POLICY "collections_insert" ON "collections"
  FOR INSERT WITH CHECK ("owner_id" = app_current_user());
CREATE POLICY "collections_update" ON "collections"
  FOR UPDATE USING ("owner_id" = app_current_user())
             WITH CHECK ("owner_id" = app_current_user());
CREATE POLICY "collections_delete" ON "collections"
  FOR DELETE USING ("owner_id" = app_current_user());

CREATE TABLE "spots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "place_id" TEXT NOT NULL,
    "added_by" TEXT NOT NULL,
    "collection_id" UUID NOT NULL,
    "photo_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "comment" TEXT NOT NULL DEFAULT '',
    "rating" "rating" NOT NULL,
    "tag_area" TEXT,
    "tag_genre" TEXT,
    "tag_situation" TEXT,
    "free_tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "origin_user_id" TEXT,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "spots_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("firebase_uid") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "spots_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "spots_origin_user_id_fkey" FOREIGN KEY ("origin_user_id") REFERENCES "users"("firebase_uid") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "spots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "spots" FORCE ROW LEVEL SECURITY;

CREATE POLICY "spots_select" ON "spots"
  FOR SELECT USING (
    "added_by" = app_current_user()
    OR EXISTS (
      SELECT 1 FROM "collections" c
      WHERE c."id" = "spots"."collection_id"
        AND ( c."owner_id" = app_current_user()
              OR (c."visibility" = 'friends' AND are_friends(c."owner_id", app_current_user())) )
    )
  );
CREATE POLICY "spots_insert" ON "spots"
  FOR INSERT WITH CHECK (
    "added_by" = app_current_user()
    AND EXISTS (
      SELECT 1 FROM "collections" c
      WHERE c."id" = "collection_id" AND c."owner_id" = app_current_user()
    )
  );
CREATE POLICY "spots_update" ON "spots"
  FOR UPDATE USING ("added_by" = app_current_user())
             WITH CHECK ("added_by" = app_current_user());
CREATE POLICY "spots_delete" ON "spots"
  FOR DELETE USING ("added_by" = app_current_user());

CREATE TABLE "recollection_edges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "spot_id" UUID NOT NULL,
    "source_spot_id" UUID,
    "actor_id" TEXT NOT NULL,
    "origin_user_id" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recollection_edges_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "recollection_edges_spot_id_fkey" FOREIGN KEY ("spot_id") REFERENCES "spots"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "recollection_edges_source_spot_id_fkey" FOREIGN KEY ("source_spot_id") REFERENCES "spots"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "recollection_edges_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("firebase_uid") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "recollection_edges_origin_user_id_fkey" FOREIGN KEY ("origin_user_id") REFERENCES "users"("firebase_uid") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "recollection_edges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recollection_edges" FORCE ROW LEVEL SECURITY;

CREATE POLICY "recollection_select" ON "recollection_edges"
  FOR SELECT USING ("actor_id" = app_current_user() OR "origin_user_id" = app_current_user());
CREATE POLICY "recollection_insert" ON "recollection_edges"
  FOR INSERT WITH CHECK ("actor_id" = app_current_user());

CREATE TABLE "flags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipient_id" TEXT NOT NULL,
    "spot_id" UUID,
    "actor_id" TEXT,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ(6),

    CONSTRAINT "flags_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "flags_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("firebase_uid") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "flags_spot_id_fkey" FOREIGN KEY ("spot_id") REFERENCES "spots"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "flags_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("firebase_uid") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "flags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "flags" FORCE ROW LEVEL SECURITY;

CREATE POLICY "flags_select_self" ON "flags"
  FOR SELECT USING ("recipient_id" = app_current_user());
CREATE POLICY "flags_update_self" ON "flags"
  FOR UPDATE USING ("recipient_id" = app_current_user())
             WITH CHECK ("recipient_id" = app_current_user());
-- Trigger inserts for another user: gate via session flag (app_user lacks BYPASSRLS).
CREATE POLICY "flags_insert_trigger" ON "flags"
  FOR INSERT WITH CHECK (current_setting('app.flags_trigger_insert', true) = '1');

CREATE OR REPLACE FUNCTION emit_flag_on_recollection() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF NEW.actor_id = NEW.origin_user_id THEN
    RETURN NEW;
  END IF;
  PERFORM set_config('app.flags_trigger_insert', '1', true);
  INSERT INTO "flags" ("recipient_id", "spot_id", "actor_id", "is_anonymous")
  VALUES (
    NEW.origin_user_id,
    NEW.spot_id,
    CASE WHEN NEW.depth >= 2 THEN NULL ELSE NEW.actor_id END,
    NEW.depth >= 2
  );
  PERFORM set_config('app.flags_trigger_insert', '', true);
  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_emit_flag"
  AFTER INSERT ON "recollection_edges"
  FOR EACH ROW EXECUTE FUNCTION emit_flag_on_recollection();

CREATE TABLE "daily_recommendations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "spot_id" UUID NOT NULL,
    "assertion" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "valid_date" DATE NOT NULL,
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_recommendations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "daily_recommendations_user_id_valid_date_key" UNIQUE ("user_id", "valid_date"),
    CONSTRAINT "daily_recommendations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("firebase_uid") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "daily_recommendations_spot_id_fkey" FOREIGN KEY ("spot_id") REFERENCES "spots"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "daily_recommendations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "daily_recommendations" FORCE ROW LEVEL SECURITY;

CREATE POLICY "daily_reco_select_self" ON "daily_recommendations"
  FOR SELECT USING ("user_id" = app_current_user());

CREATE INDEX "idx_spots_place" ON "spots"("place_id");
CREATE INDEX "idx_spots_collection" ON "spots"("collection_id");
CREATE INDEX "idx_spots_added_by" ON "spots"("added_by");
CREATE INDEX "idx_spots_tags" ON "spots"("tag_area", "tag_genre", "tag_situation");
CREATE INDEX "idx_spots_freetags" ON "spots" USING GIN ("free_tags");
CREATE INDEX "idx_collections_owner" ON "collections"("owner_id");
CREATE INDEX "idx_flags_recipient" ON "flags"("recipient_id", "created_at" DESC);
CREATE INDEX "idx_reco_edges_origin" ON "recollection_edges"("origin_user_id");
CREATE INDEX "idx_reco_edges_actor" ON "recollection_edges"("actor_id");
