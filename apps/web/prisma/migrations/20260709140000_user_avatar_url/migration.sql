-- Photo avatar URL for Slack-style profile pictures (#259).
ALTER TABLE "users" ADD COLUMN "avatar_url" text;
