-- Twelve tables were readable by anyone holding the anon key. That key is
-- NEXT_PUBLIC_SUPABASE_ANON_KEY, which ships in the client bundle, so their
-- contents were effectively public:
--
--   request_logs                    596846 rows - IP addresses, city/country,
--                                                 user agents, request payloads
--   burn_low_income_applications       922 rows - financial hardship applications
--   burn_membership_checkin_events    4956 rows - who checked in and when
--   burn_welcome                      2024 rows - welcome messages
--   burn_saved_seats                  1846 rows - seat assignments
--   burn_membership_transfers          814 rows - who transferred to whom
--   burn_idea_votes                     56 rows - who voted for what
--   burn_membership_notes               32 rows - member notes, incl. special
--                                                 circumstances
--   burn_ideas, burn_timeline_events, burn_links, questions - content
--
-- Enabling RLS with no policies denies every role except the service role, which
-- bypasses RLS. That is how this codebase already reaches its data: every route
-- in app/api builds its client with SUPABASE_SERVICE_ROLE_KEY and enforces
-- authorization itself via the requestWith* wrappers in
-- app/api/_common/endpoints.ts.
--
-- Nothing in the browser reads these tables directly. Client-side Supabase use is
-- limited to auth and the pet-photos storage bucket, so no application code
-- changes are needed alongside this.
--
-- burn_memberships, burn_membership_purchase_rights, burn_config (which holds the
-- Stripe secret key), projects, profiles, roles, role_assignments and
-- burn_lottery_tickets already denied anon and are untouched here.

alter table request_logs enable row level security;
alter table burn_low_income_applications enable row level security;
alter table burn_membership_checkin_events enable row level security;
alter table burn_membership_notes enable row level security;
alter table burn_membership_transfers enable row level security;
alter table burn_saved_seats enable row level security;
alter table burn_welcome enable row level security;
alter table burn_ideas enable row level security;
alter table burn_idea_votes enable row level security;
alter table burn_timeline_events enable row level security;
alter table burn_links enable row level security;
alter table questions enable row level security;
