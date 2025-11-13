create table burn_ideas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  project_id uuid references projects not null,
  owner_id uuid references profiles not null,
  title text not null,
  description text,
  check (char_length(trim(title)) > 0)
);

create index burn_ideas_project_id_idx on burn_ideas(project_id);
create index burn_ideas_owner_id_idx on burn_ideas(owner_id);

create table burn_idea_votes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  idea_id uuid references burn_ideas on delete cascade not null,
  owner_id uuid references profiles not null,
  unique (idea_id, owner_id)
);

create index burn_idea_votes_idea_id_idx on burn_idea_votes(idea_id);
create index burn_idea_votes_owner_id_idx on burn_idea_votes(owner_id);

-- Create a function to automatically update updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create a trigger to automatically update updated_at
create trigger update_burn_ideas_updated_at
  before update on burn_ideas
  for each row
  execute function update_updated_at_column();

