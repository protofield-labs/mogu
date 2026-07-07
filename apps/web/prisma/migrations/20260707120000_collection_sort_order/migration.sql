-- Collection manual sort order (#121)
ALTER TABLE collections ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_collections_owner_sort ON collections (owner_id, sort_order);

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY owner_id
      ORDER BY updated_at DESC, created_at DESC
    ) - 1 AS ord
  FROM collections
)
UPDATE collections AS c
SET sort_order = ranked.ord
FROM ranked
WHERE c.id = ranked.id;
