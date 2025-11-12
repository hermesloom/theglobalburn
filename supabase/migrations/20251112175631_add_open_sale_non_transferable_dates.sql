alter table burn_config
  add column open_sale_non_transferable_starting_at timestamp with time zone,
  add column open_sale_non_transferable_ending_at timestamp with time zone;

