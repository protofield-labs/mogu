-- Demo seed session flag for daily_recommendations inserts (#46).
-- Normal app users cannot insert; seed script sets app.demo_seed = '1'.

CREATE POLICY "daily_reco_insert_seed" ON "daily_recommendations"
  FOR INSERT WITH CHECK (
    current_setting('app.demo_seed', true) = '1'
  );
