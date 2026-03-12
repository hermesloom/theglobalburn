alter table burn_config
  alter column share_memberships_lottery type float using share_memberships_lottery::float,
  alter column share_memberships_low_income type float using share_memberships_low_income::float;
