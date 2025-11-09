-- Recreate burn_stage without 'open-sale-non-refundable' and with 'open-sale-non-transferrable'

CREATE TYPE burn_stage_new AS ENUM (
  'lottery-open',
  'lottery-closed',
  'open-sale-lottery-entrants-only',
  'open-sale-general',
  'open-sale-non-transferrable'
);

ALTER TABLE burn_config
  ALTER COLUMN current_stage TYPE burn_stage_new
  USING current_stage::text::burn_stage_new;

DROP TYPE burn_stage;

ALTER TYPE burn_stage_new RENAME TO burn_stage;
