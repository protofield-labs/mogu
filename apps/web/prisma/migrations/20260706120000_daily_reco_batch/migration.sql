-- Batch upsert for daily_recommendations (#42).
-- Called from scripts/generate-daily-recommendations.ts (Cloud Scheduler / cron).

CREATE OR REPLACE FUNCTION upsert_daily_recommendation(
  p_user_id text,
  p_spot_id uuid,
  p_assertion text,
  p_evidence text,
  p_valid_date date
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO "daily_recommendations" (
    "user_id",
    "spot_id",
    "assertion",
    "evidence",
    "valid_date"
  )
  VALUES (
    p_user_id,
    p_spot_id,
    p_assertion,
    p_evidence,
    p_valid_date
  )
  ON CONFLICT ("user_id", "valid_date") DO UPDATE SET
    "spot_id" = EXCLUDED."spot_id",
    "assertion" = EXCLUDED."assertion",
    "evidence" = EXCLUDED."evidence",
    "generated_at" = now();
END;
$$;
