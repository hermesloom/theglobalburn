create table burn_low_income_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  project_id uuid references projects not null,
  owner_id uuid references profiles not null,
  unique (project_id, owner_id)
);
create index burn_low_income_applications_project_id_idx on burn_low_income_applications(project_id);
create index burn_low_income_applications_owner_id_idx on burn_low_income_applications(owner_id);
