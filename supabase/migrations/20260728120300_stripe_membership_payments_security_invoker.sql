-- Postgres views run with their owner's privileges unless told otherwise, which
-- means stripe_membership_payments bypassed the row level security on its base
-- tables: querying the view with the public anon key returned payment rows that
-- querying the tables directly correctly refused.
--
-- security_invoker makes the view evaluate base-table reads as the querying role,
-- so RLS applies and anon gets nothing. The API routes are unaffected — they use
-- the service role key, which bypasses RLS either way.
alter view stripe_membership_payments set (security_invoker = on);
