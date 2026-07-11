-- Prisma upsert on demo collections needs SELECT visibility during demo seed.

CREATE POLICY "collections_select_seed" ON "collections"
  FOR SELECT USING (
    current_setting('app.demo_seed', true) = '1'
    AND "id"::text LIKE '11111111-1111-4111-8111-%'
  );
