create table burn_timeline_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  project_id uuid references projects not null,
  title text not null,
  body text,
  date timestamp with time zone,
  date_end timestamp with time zone
);

create index burn_timeline_events_project_id_idx on burn_timeline_events(project_id);

-- Create a trigger to automatically update updated_at
create trigger update_burn_timeline_events_updated_at
  before update on burn_timeline_events
  for each row
  execute function update_updated_at_column();
