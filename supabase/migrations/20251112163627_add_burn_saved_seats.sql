create table burn_saved_seats (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  project_id uuid references projects not null,
  owner_id uuid references profiles not null,
  unique (project_id, owner_id)
);

create index burn_saved_seats_project_id_idx on burn_saved_seats(project_id);
create index burn_saved_seats_owner_id_idx on burn_saved_seats(owner_id);

