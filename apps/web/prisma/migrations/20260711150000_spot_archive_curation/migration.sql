-- Persona collection curation (#318): archive closed spots, batch writes.

ALTER TABLE "spots"
  ADD COLUMN "archived_at" TIMESTAMPTZ(6);

CREATE INDEX "idx_spots_archived_at" ON "spots"("archived_at");

DROP POLICY IF EXISTS "spots_select" ON "spots";
CREATE POLICY "spots_select" ON "spots"
  FOR SELECT USING (
    "archived_at" IS NULL
    AND (
      "added_by" = app_current_user()
      OR EXISTS (
        SELECT 1 FROM "collections" c
        WHERE c."id" = "spots"."collection_id"
          AND ( c."owner_id" = app_current_user()
                OR (c."visibility" = 'friends' AND are_friends(c."owner_id", app_current_user())) )
      )
    )
  );

CREATE POLICY "spots_update_curation_batch" ON "spots"
  FOR UPDATE USING (
    current_setting('app.persona_curation_batch', true) = '1'
  ) WITH CHECK (
    current_setting('app.persona_curation_batch', true) = '1'
  );

CREATE POLICY "spots_insert_curation_batch" ON "spots"
  FOR INSERT WITH CHECK (
    current_setting('app.persona_curation_batch', true) = '1'
  );

CREATE OR REPLACE FUNCTION archive_persona_spot(p_spot_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_spot_id::text NOT LIKE '22222222-2222-4222-8222-%'
     OR p_spot_id::text IN (
       '22222222-2222-4222-8222-222222222201',
       '22222222-2222-4222-8222-222222222301'
     )
     OR NOT EXISTS (
       SELECT 1 FROM "spots" s
       WHERE s."id" = p_spot_id
         AND s."collection_id"::text IN (
           '11111111-1111-4111-8111-111111111101',
           '11111111-1111-4111-8111-111111111201'
         )
         AND s."added_by" IN ('demo-ken', 'demo-aoi')
     ) THEN
    RETURN;
  END IF;

  PERFORM set_config('app.persona_curation_batch', '1', true);
  UPDATE "spots"
  SET "archived_at" = now(),
      "updated_at" = now()
  WHERE "id" = p_spot_id
    AND "archived_at" IS NULL;
  PERFORM set_config('app.persona_curation_batch', '', true);
END;
$$;

CREATE OR REPLACE FUNCTION insert_persona_curation_spot(
  p_spot_id uuid,
  p_place_id text,
  p_added_by text,
  p_collection_id uuid,
  p_comment text,
  p_rating rating,
  p_tag_area text,
  p_tag_genre text,
  p_tag_situation text,
  p_free_tags text[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_added_by NOT IN ('demo-ken', 'demo-aoi')
     OR p_collection_id::text NOT IN (
       '11111111-1111-4111-8111-111111111101',
       '11111111-1111-4111-8111-111111111201'
     ) THEN
    RETURN;
  END IF;

  PERFORM set_config('app.persona_curation_batch', '1', true);
  INSERT INTO "spots" (
    "id",
    "place_id",
    "added_by",
    "collection_id",
    "comment",
    "rating",
    "tag_area",
    "tag_genre",
    "tag_situation",
    "free_tags"
  )
  VALUES (
    p_spot_id,
    p_place_id,
    p_added_by,
    p_collection_id,
    p_comment,
    p_rating,
    p_tag_area,
    p_tag_genre,
    p_tag_situation,
    COALESCE(p_free_tags, ARRAY[]::text[])
  )
  ON CONFLICT ("id") DO NOTHING;
  PERFORM set_config('app.persona_curation_batch', '', true);
END;
$$;

REVOKE ALL ON FUNCTION archive_persona_spot(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION insert_persona_curation_spot(uuid, text, text, uuid, text, rating, text, text, text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION archive_persona_spot(uuid) TO app_user;
GRANT EXECUTE ON FUNCTION insert_persona_curation_spot(uuid, text, text, uuid, text, rating, text, text, text, text[]) TO app_user;
