CREATE INDEX IF NOT EXISTS burn_memberships_project_id_owner_id_idx
  ON burn_memberships (project_id, owner_id);

CREATE INDEX IF NOT EXISTS burn_membership_transfers_project_id_created_at_idx
  ON burn_membership_transfers (project_id, created_at DESC);
