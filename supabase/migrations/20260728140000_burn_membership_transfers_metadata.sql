-- Lets a failed transfer refund be recorded on the row itself, so members who are
-- owed money can be found with a query rather than by reading server logs.
--
-- IF NOT EXISTS because the statistics work adds the same column for its backfill
-- marker; whichever migration lands first wins and the other is a no-op.
alter table burn_membership_transfers add column if not exists metadata jsonb;
