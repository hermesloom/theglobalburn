alter table burn_membership_purchase_rights add column is_non_transferable boolean default false;
alter table burn_memberships add column is_non_transferable boolean default false;
