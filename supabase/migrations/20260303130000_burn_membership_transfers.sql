create table burn_membership_transfers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  project_id uuid references projects not null,
  from_owner_id uuid references profiles not null,
  to_owner_id uuid references profiles not null,
  refund_amount float not null,
  price_currency text not null,
  original_membership_json jsonb
);

create index burn_membership_transfers_project_id_idx on burn_membership_transfers(project_id);
create index burn_membership_transfers_from_owner_id_idx on burn_membership_transfers(from_owner_id);
create index burn_membership_transfers_to_owner_id_idx on burn_membership_transfers(to_owner_id);
create index burn_membership_transfers_created_at_idx on burn_membership_transfers(created_at);
