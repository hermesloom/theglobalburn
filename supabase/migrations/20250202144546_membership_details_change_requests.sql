create table burn_membership_details_change_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  project_id uuid references projects not null,
  owner_id uuid references profiles not null,
  first_name text not null,
  last_name text not null,
  birthdate text not null,
  message text not null,
  unique (project_id, owner_id),
  check (birthdate ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
);

