create table burn_welcome (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  project_id uuid references projects not null,
  owner_id uuid references profiles not null,
  message text not null,
  check (char_length(trim(message)) > 0)
);

create index burn_welcome_project_id_idx on burn_welcome(project_id);
create index burn_welcome_owner_id_idx on burn_welcome(owner_id);

