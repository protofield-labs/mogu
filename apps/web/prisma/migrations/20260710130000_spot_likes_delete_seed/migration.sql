-- Allow demo seed wipe to delete likes on fixed demo spots (#317).
CREATE POLICY "spot_likes_delete_seed" ON "spot_likes"
  FOR DELETE USING (
    current_setting('app.demo_seed', true) = '1'
  );
