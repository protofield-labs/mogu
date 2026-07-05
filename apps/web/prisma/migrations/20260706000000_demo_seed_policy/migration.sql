-- Demo seed session flags (#46).
-- Seed script sets app.demo_seed = '1' for bootstrap inserts/deletes.

CREATE POLICY "daily_reco_insert_seed" ON "daily_recommendations"
  FOR INSERT WITH CHECK (
    current_setting('app.demo_seed', true) = '1'
  );

CREATE POLICY "daily_reco_delete_seed" ON "daily_recommendations"
  FOR DELETE USING (
    current_setting('app.demo_seed', true) = '1'
  );

CREATE POLICY "flags_delete_seed" ON "flags"
  FOR DELETE USING (
    current_setting('app.demo_seed', true) = '1'
  );

CREATE POLICY "recollection_delete_seed" ON "recollection_edges"
  FOR DELETE USING (
    current_setting('app.demo_seed', true) = '1'
  );

CREATE POLICY "spots_delete_seed" ON "spots"
  FOR DELETE USING (
    current_setting('app.demo_seed', true) = '1'
  );

CREATE POLICY "collections_delete_seed" ON "collections"
  FOR DELETE USING (
    current_setting('app.demo_seed', true) = '1'
  );

CREATE POLICY "friendships_delete_seed" ON "friendships"
  FOR DELETE USING (
    current_setting('app.demo_seed', true) = '1'
  );

CREATE POLICY "users_delete_seed" ON "users"
  FOR DELETE USING (
    current_setting('app.demo_seed', true) = '1'
    AND "firebase_uid" LIKE 'demo-%'
  );

-- Idempotent wipe for fixed demo IDs (bypasses RLS, respects FK order).
CREATE OR REPLACE FUNCTION demo_seed_wipe(p_viewer_uid text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM "daily_recommendations"
  WHERE "user_id" = p_viewer_uid
     OR "user_id" LIKE 'demo-%';

  DELETE FROM "flags"
  WHERE "recipient_id" = p_viewer_uid
     OR "recipient_id" LIKE 'demo-%';

  DELETE FROM "recollection_edges"
  WHERE "id" IN (
    '44444444-4444-4444-8444-444444444401'::uuid,
    '44444444-4444-4444-8444-444444444402'::uuid
  );

  DELETE FROM "spots"
  WHERE "id"::text LIKE '22222222-2222-4222-8222-%'
     OR "collection_id"::text LIKE '11111111-1111-4111-8111-%';

  DELETE FROM "collections"
  WHERE "id"::text LIKE '11111111-1111-4111-8111-%';

  DELETE FROM "friendships"
  WHERE "user_low" LIKE 'demo-%'
     OR "user_high" LIKE 'demo-%'
     OR "user_low" = p_viewer_uid
     OR "user_high" = p_viewer_uid;

  DELETE FROM "users"
  WHERE "firebase_uid" LIKE 'demo-%';

  IF p_viewer_uid = 'demo-viewer' THEN
    DELETE FROM "users" WHERE "firebase_uid" = 'demo-viewer';
  END IF;
END;
$$;
