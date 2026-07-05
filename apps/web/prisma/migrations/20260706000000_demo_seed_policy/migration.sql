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
