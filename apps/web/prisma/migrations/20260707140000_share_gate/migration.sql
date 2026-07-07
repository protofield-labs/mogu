-- Share gate metadata for non-friends (#122). SECURITY DEFINER; owner name + resource title only.

CREATE OR REPLACE FUNCTION get_collection_share_gate(p_viewer text, p_collection_id uuid)
RETURNS TABLE (
  owner_id text,
  owner_display_name text,
  collection_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.owner_id, u.display_name, c.name
  FROM collections c
  JOIN users u ON u.firebase_uid = c.owner_id
  WHERE c.id = p_collection_id
    AND c.visibility = 'friends'
    AND c.owner_id <> p_viewer
    AND NOT are_friends(c.owner_id, p_viewer)
$$;

CREATE OR REPLACE FUNCTION get_spot_share_gate(p_viewer text, p_spot_id uuid)
RETURNS TABLE (
  owner_id text,
  owner_display_name text,
  collection_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.owner_id, u.display_name, c.name
  FROM spots s
  JOIN collections c ON c.id = s.collection_id
  JOIN users u ON u.firebase_uid = c.owner_id
  WHERE s.id = p_spot_id
    AND s.depth < 2
    AND c.visibility = 'friends'
    AND c.owner_id <> p_viewer
    AND NOT are_friends(c.owner_id, p_viewer)
$$;

REVOKE ALL ON FUNCTION get_collection_share_gate(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_spot_share_gate(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_collection_share_gate(text, uuid) TO app_user;
GRANT EXECUTE ON FUNCTION get_spot_share_gate(text, uuid) TO app_user;
