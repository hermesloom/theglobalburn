/**
 * How much to refund the member giving up their membership in a transfer.
 *
 * The basis is what Stripe says is *still refundable* on the original payment,
 * not burn_memberships.price. That column is not reduced by refunds made outside
 * the transfer flow — a manual dashboard refund of an Alversjö addon, say — so it
 * can claim a member paid more than they still hold. When it did, the resulting
 * refund exceeded the refundable balance, Stripe rejected it, and the member was
 * left unpaid for weeks.
 *
 * Both arguments and the result are in Stripe minor units.
 */
export function transferRefundAmount(
  stillRefundable: number,
  transferFeePercentage: number,
): number {
  if (stillRefundable <= 0) return 0;
  const fee = Math.min(Math.max(transferFeePercentage, 0), 100);
  return Math.round(stillRefundable * (1 - fee / 100));
}
