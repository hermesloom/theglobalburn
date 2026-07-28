-- One row per paid checkout session, joined to everything needed to compute
-- income. Stripe facts only: the policy (which sale, how a refund splits between
-- membership and Alversjö, how the fee prorates) lives in utils/stripe/attribution.ts
-- so that it is unit-tested and can change without a migration.
--
-- Not materialised: it reads burn_membership_purchase_rights, which changes
-- independently of any Stripe sync, and 13k rows makes recomputation free.

create view stripe_membership_payments as
select
  s.id                                as session_id,
  s.payment_intent_id                 as payment_intent_id,
  s.created_at                        as paid_at,
  mpr.project_id                      as project_id,
  upper(s.currency)                   as currency,
  coalesce(s.amount_total, 0)         as amount_total,
  coalesce(bt.fee, 0)                 as fee,
  coalesce(r.fee_refunded, 0)         as fee_refunded,
  coalesce(d.disputed_amount, 0)      as disputed_amount,
  coalesce(d.dispute_fee, 0)          as dispute_fee,
  coalesce(
    (mpr.metadata -> 'enabled_addons') ? 'alversjo-membership',
    false
  )                                   as has_alversjo,
  coalesce(r.refunds, '[]'::jsonb)    as refunds
from stripe_checkout_sessions s
-- The succeeded charge for this payment intent. A payment intent can accumulate
-- failed attempts, so filter on status rather than taking the first row.
left join lateral (
  select c.*
  from stripe_charges c
  where c.payment_intent_id = s.payment_intent_id
    and c.status = 'succeeded'
  order by c.created_at
  limit 1
) c on true
left join stripe_balance_transactions bt
  on bt.id = c.balance_transaction_id
-- Succeeded refunds, individually (the Alversjö rule needs each amount, not a sum)
-- plus the fees Stripe gave back on them, which are negative.
left join lateral (
  select
    jsonb_agg(jsonb_build_object('amount', rf.amount) order by rf.created_at)
      as refunds,
    coalesce(sum(rbt.fee), 0) as fee_refunded
  from stripe_refunds rf
  left join stripe_balance_transactions rbt on rbt.id = rf.balance_transaction_id
  where rf.payment_intent_id = s.payment_intent_id
    and rf.status = 'succeeded'
) r on true
-- Disputes are read through their balance transactions rather than their status:
-- the money is withdrawn when the dispute opens and returned by a reversing entry
-- if it is won, so summing the entries is self-correcting.
left join lateral (
  select
    coalesce(-sum(dbt.amount), 0) as disputed_amount,
    coalesce(sum(dbt.fee), 0)     as dispute_fee
  from stripe_disputes dp
  left join stripe_balance_transactions dbt
    on dbt.id = any(dp.balance_transaction_ids)
  where dp.charge_id = c.id
) d on true
left join burn_membership_purchase_rights mpr
  on mpr.id = s.membership_purchase_right_id
where s.payment_status = 'paid';
