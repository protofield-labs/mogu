-- Harden demo seed RLS delete policies and remove unused SECURITY DEFINER wipe (#331).

DROP POLICY IF EXISTS "daily_reco_delete_seed" ON "daily_recommendations";
CREATE POLICY "daily_reco_delete_seed" ON "daily_recommendations"
  FOR DELETE USING (
    current_setting('app.demo_seed', true) = '1'
    AND (
      "user_id" LIKE 'demo-%'
      OR "user_id" = current_setting('app.current_user_id', true)
    )
  );

DROP POLICY IF EXISTS "flags_delete_seed" ON "flags";
CREATE POLICY "flags_delete_seed" ON "flags"
  FOR DELETE USING (
    current_setting('app.demo_seed', true) = '1'
    AND (
      "recipient_id" LIKE 'demo-%'
      OR "recipient_id" = current_setting('app.current_user_id', true)
    )
  );

DROP POLICY IF EXISTS "recollection_delete_seed" ON "recollection_edges";
CREATE POLICY "recollection_delete_seed" ON "recollection_edges"
  FOR DELETE USING (
    current_setting('app.demo_seed', true) = '1'
    AND "id"::text IN (
      '44444444-4444-4444-8444-444444444401',
      '44444444-4444-4444-8444-444444444402'
    )
  );

DROP POLICY IF EXISTS "spots_delete_seed" ON "spots";
CREATE POLICY "spots_delete_seed" ON "spots"
  FOR DELETE USING (
    current_setting('app.demo_seed', true) = '1'
    AND (
      "id"::text LIKE '22222222-2222-4222-8222-%'
      OR "collection_id"::text LIKE '11111111-1111-4111-8111-%'
    )
  );

DROP POLICY IF EXISTS "collections_delete_seed" ON "collections";
CREATE POLICY "collections_delete_seed" ON "collections"
  FOR DELETE USING (
    current_setting('app.demo_seed', true) = '1'
    AND "id"::text LIKE '11111111-1111-4111-8111-%'
  );

DROP POLICY IF EXISTS "friendships_delete_seed" ON "friendships";
CREATE POLICY "friendships_delete_seed" ON "friendships"
  FOR DELETE USING (
    current_setting('app.demo_seed', true) = '1'
    AND (
      "user_low" LIKE 'demo-%'
      OR "user_high" LIKE 'demo-%'
    )
  );

DROP POLICY IF EXISTS "spot_likes_delete_seed" ON "spot_likes";
CREATE POLICY "spot_likes_delete_seed" ON "spot_likes"
  FOR DELETE USING (
    current_setting('app.demo_seed', true) = '1'
    AND "spot_id"::text LIKE '22222222-2222-4222-8222-%'
  );

DROP FUNCTION IF EXISTS demo_seed_wipe(text);
