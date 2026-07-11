-- I1: shared budget reservation primitives (§3)
-- Call inside an explicit transaction: BEGIN; SELECT ops.reserve_*; COMMIT;

CREATE OR REPLACE FUNCTION ops.ensure_budget_row(p_usage_date date DEFAULT (now() AT TIME ZONE 'UTC')::date)
RETURNS date
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ops, pg_temp
AS $$
BEGIN
  INSERT INTO ops.budget_usage (usage_date)
  VALUES (p_usage_date)
  ON CONFLICT (usage_date) DO NOTHING;

  RETURN p_usage_date;
END;
$$;

CREATE OR REPLACE FUNCTION ops.reserve_embedding_budget(p_max int)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ops, pg_temp
AS $$
DECLARE
  v_date date;
  v_count int;
BEGIN
  IF p_max < 0 THEN
    RAISE EXCEPTION 'p_max must be non-negative';
  END IF;

  v_date := ops.ensure_budget_row();

  SELECT embedding_count
    INTO v_count
    FROM ops.budget_usage
   WHERE usage_date = v_date
     FOR UPDATE;

  IF v_count >= p_max THEN
    RETURN false;
  END IF;

  UPDATE ops.budget_usage
     SET embedding_count = embedding_count + 1
   WHERE usage_date = v_date;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION ops.reserve_investigation_budget(p_max int)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ops, pg_temp
AS $$
DECLARE
  v_date date;
  v_count int;
BEGIN
  IF p_max < 0 THEN
    RAISE EXCEPTION 'p_max must be non-negative';
  END IF;

  v_date := ops.ensure_budget_row();

  SELECT investigation_count
    INTO v_count
    FROM ops.budget_usage
   WHERE usage_date = v_date
     FOR UPDATE;

  IF v_count >= p_max THEN
    RETURN false;
  END IF;

  UPDATE ops.budget_usage
     SET investigation_count = investigation_count + 1
   WHERE usage_date = v_date;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION ops.ensure_budget_row(date) IS
  'Lazy-create UTC daily budget row. Used by reserve_* functions.';

COMMENT ON FUNCTION ops.reserve_embedding_budget(int) IS
  'Atomically reserve one embedding slot under FOR UPDATE. Returns false when at cap.';

COMMENT ON FUNCTION ops.reserve_investigation_budget(int) IS
  'Atomically reserve one investigation slot under FOR UPDATE. Returns false when at cap.';
