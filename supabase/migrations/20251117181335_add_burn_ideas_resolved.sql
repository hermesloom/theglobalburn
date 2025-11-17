alter table burn_ideas add column resolved boolean default false not null;

create index burn_ideas_resolved_idx on burn_ideas(resolved);

