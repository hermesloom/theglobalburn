-- Marks rows reconstructed by scripts/backfill-membership-transfers.mjs, whose
-- original_membership_json is rebuilt from the purchase right and is therefore
-- partial compared to rows written live by the Stripe webhook.
alter table burn_membership_transfers add column metadata jsonb;
