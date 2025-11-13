create table burn_links (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  project_id uuid references projects not null,
  label text not null,
  url text not null,
  emoji text,
  display_order integer default 0,
  check (url ~ '^https?://')
);

create index burn_links_project_id_idx on burn_links(project_id);
create index burn_links_display_order_idx on burn_links(project_id, display_order);

-- Create a function to automatically update updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create a trigger to automatically update updated_at
create trigger update_burn_links_updated_at
  before update on burn_links
  for each row
  execute function update_updated_at_column();

