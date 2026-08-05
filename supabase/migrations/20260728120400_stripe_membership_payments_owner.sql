-- Adds the paying owner to the view so a transfer can be paired with the incoming
-- payment by identity (the transfer knows to_owner_id) rather than by timestamp
-- proximity alone. Needed for the transfer surplus figure.
--
-- create or replace cannot add a column to an existing view, so drop first.
-- security_invoker is re-applied because it is a property of the view object.
drop view stripe_membership_payments;

create view stripe_membership_payments as
select
  s.id                                as session_id,
  s.payment_intent_id                 as payment_intent_id,
  s.created_at                        as paid_at,
  mpr.project_id                      as project_id,
  mpr.owner_id                        as owner_id,
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

alter view stripe_membership_payments set (security_invoker = on);
