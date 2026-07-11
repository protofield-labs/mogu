-- Demo seed can clear archived_at on fixed demo persona spots (#318).

CREATE POLICY "spots_update_seed" ON "spots"
  FOR UPDATE USING (
    current_setting('app.demo_seed', true) = '1'
    AND "id"::text LIKE '22222222-2222-4222-8222-%'
  ) WITH CHECK (
    current_setting('app.demo_seed', true) = '1'
    AND "id"::text LIKE '22222222-2222-4222-8222-%'
  );
