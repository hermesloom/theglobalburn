create table burn_membership_checkin_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  project_id uuid references projects not null,
  membership_id uuid references burn_memberships not null,
  actor_profile_id uuid references profiles not null,
  event_type text not null check (event_type in ('check_in', 'check_out'))
);

create index burn_membership_checkin_events_project_membership_idx
  on burn_membership_checkin_events(project_id, membership_id);
