create table burn_membership_notes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  project_id uuid references projects not null,
  membership_id uuid references burn_memberships not null,
  actor_profile_id uuid references profiles not null,
  note text not null
);

create index burn_membership_notes_project_membership_idx
  on burn_membership_notes(project_id, membership_id);
