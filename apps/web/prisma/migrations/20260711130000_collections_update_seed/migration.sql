-- Allow demo seed to reassign fixed demo collection rows (e.g. viewer wishlist owner).

CREATE POLICY "collections_update_seed" ON "collections"
  FOR UPDATE USING (
    current_setting('app.demo_seed', true) = '1'
    AND "id"::text LIKE '11111111-1111-4111-8111-%'
  )
  WITH CHECK (
    current_setting('app.demo_seed', true) = '1'
    AND "id"::text LIKE '11111111-1111-4111-8111-%'
  );
