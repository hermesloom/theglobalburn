-- add a column to the burn_config table to store the plus_one_reservation_duration value
alter table burn_config add column plus_one_reservation_duration bigint; -- in seconds, determines how long a user who has been invited via +1 has time to purchase a membership
