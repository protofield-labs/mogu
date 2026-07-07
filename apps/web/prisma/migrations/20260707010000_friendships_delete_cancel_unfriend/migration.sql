-- Allow participants to cancel pending requests (requester) and unfriend (accepted).
-- App layer enforces cancel vs reject; RLS permits DELETE for pending and accepted rows.
DROP POLICY IF EXISTS "friendships_delete" ON "friendships";

CREATE POLICY "friendships_delete" ON "friendships"
  FOR DELETE USING (
    ("user_low" = app_current_user() OR "user_high" = app_current_user())
    AND "status" IN ('pending'::"friendship_status", 'accepted'::"friendship_status")
  );
