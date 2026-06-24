-- Returns the full transfer chain (backward) for a set of current owner IDs,
-- with from/to emails already joined so the caller never needs to batch-fetch profiles.
CREATE OR REPLACE FUNCTION get_transfer_chains(p_owner_ids uuid[], p_project_id uuid)
RETURNS TABLE(
  id uuid,
  created_at timestamptz,
  from_owner_id uuid,
  to_owner_id uuid,
  original_membership_json jsonb,
  from_email text,
  to_email text
) AS $$
WITH RECURSIVE chain AS (
  SELECT t.id, t.created_at, t.from_owner_id, t.to_owner_id, t.original_membership_json
  FROM burn_membership_transfers t
  WHERE t.project_id = p_project_id
    AND t.to_owner_id = ANY(p_owner_ids)
  UNION ALL
  SELECT t.id, t.created_at, t.from_owner_id, t.to_owner_id, t.original_membership_json
  FROM burn_membership_transfers t
  JOIN chain c ON t.to_owner_id = c.from_owner_id
  WHERE t.project_id = p_project_id
)
SELECT DISTINCT
  c.id,
  c.created_at,
  c.from_owner_id,
  c.to_owner_id,
  c.original_membership_json,
  p_from.email AS from_email,
  p_to.email   AS to_email
FROM chain c
LEFT JOIN profiles p_from ON p_from.id = c.from_owner_id
LEFT JOIN profiles p_to   ON p_to.id   = c.to_owner_id
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Finds current owner IDs for memberships whose *previous* owner's name or email
-- matches the search, then walks forward through the transfer chain to the current owner.
CREATE OR REPLACE FUNCTION search_transfers_by_previous_owner(
  p_search_terms text[],
  p_search_term  text,
  p_project_id   uuid
)
RETURNS TABLE(current_owner_id uuid) AS $$
WITH RECURSIVE
matching_transfers AS (
  SELECT t.to_owner_id
  FROM burn_membership_transfers t
  LEFT JOIN profiles p ON p.id = t.from_owner_id
  WHERE t.project_id = p_project_id
    AND (
      EXISTS (
        SELECT 1 FROM unnest(p_search_terms) AS term
        WHERE (t.original_membership_json->>'first_name') ILIKE '%' || term || '%'
           OR (t.original_membership_json->>'last_name')  ILIKE '%' || term || '%'
      )
      OR p.email ILIKE '%' || p_search_term || '%'
    )
),
forward_chain(owner_id) AS (
  SELECT to_owner_id FROM matching_transfers
  UNION ALL
  SELECT t.to_owner_id
  FROM burn_membership_transfers t
  JOIN forward_chain fc ON t.from_owner_id = fc.owner_id
  WHERE t.project_id = p_project_id
)
SELECT DISTINCT owner_id FROM forward_chain
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_transfer_chains(uuid[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION search_transfers_by_previous_owner(text[], text, uuid) TO authenticated;
