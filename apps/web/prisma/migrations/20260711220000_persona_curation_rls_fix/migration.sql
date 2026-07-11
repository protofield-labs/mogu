-- Hotfix: persona curation functions must set app.current_user_id so spots RLS
-- passes under FORCE ROW LEVEL SECURITY (#318).

DROP FUNCTION IF EXISTS archive_persona_spot(uuid);
DROP FUNCTION IF EXISTS insert_persona_curation_spot(uuid, text, text, uuid, text, rating, text, text, text, text[]);

CREATE OR REPLACE FUNCTION archive_persona_spot(p_spot_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_uid text;
  updated_count integer;
BEGIN
  SELECT s."added_by"
  INTO actor_uid
  FROM "spots" s
  WHERE s."id" = p_spot_id
    AND s."archived_at" IS NULL
    AND s."collection_id"::text IN (
      '11111111-1111-4111-8111-111111111101',
      '11111111-1111-4111-8111-111111111201'
    )
    AND s."added_by" IN ('demo-ken', 'demo-aoi');

  IF actor_uid IS NULL
     OR p_spot_id::text NOT LIKE '22222222-2222-4222-8222-%'
     OR p_spot_id::text IN (
       '22222222-2222-4222-8222-222222222201',
       '22222222-2222-4222-8222-222222222301'
     ) THEN
    RETURN false;
  END IF;

  PERFORM set_config('app.current_user_id', actor_uid, true);
  PERFORM set_config('app.persona_curation_batch', '1', true);
  UPDATE "spots"
  SET "archived_at" = now(),
      "updated_at" = now()
  WHERE "id" = p_spot_id
    AND "archived_at" IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  PERFORM set_config('app.persona_curation_batch', '', true);
  RETURN updated_count = 1;
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
) RETURNS boolean
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
    RETURN false;
  END IF;

  PERFORM set_config('app.current_user_id', p_added_by, true);
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

  RETURN EXISTS (
    SELECT 1
    FROM "spots" s
    WHERE s."id" = p_spot_id
      AND s."archived_at" IS NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION archive_persona_spot(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION insert_persona_curation_spot(uuid, text, text, uuid, text, rating, text, text, text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION archive_persona_spot(uuid) TO app_user;
GRANT EXECUTE ON FUNCTION insert_persona_curation_spot(uuid, text, text, uuid, text, rating, text, text, text, text[]) TO app_user;
