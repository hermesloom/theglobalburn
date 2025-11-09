-- Add new value to burn_stage enum
ALTER TYPE burn_stage
  ADD VALUE IF NOT EXISTS 'open-sale-non-refundable';
