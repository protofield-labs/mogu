-- Allow recipients to reject pending friend requests (DELETE row).
-- Matches rejectFriendRequest(): pending only, requested_by <> current user.
CREATE POLICY "friendships_delete" ON "friendships"
  FOR DELETE USING (
    ("user_low" = app_current_user() OR "user_high" = app_current_user())
    AND "status" = 'pending'::"friendship_status"
    AND "requested_by" <> app_current_user()
  );
