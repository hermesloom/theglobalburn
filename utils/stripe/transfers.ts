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

/** Where failed-refund alerts go. */
export const REFUND_FAILURE_ALERT_EMAIL = "tech@theborderland.se";

/**
 * The alert sent when a transfer refund fails. Someone is owed money and only a
 * human can put it right, so the message leads with that and carries everything
 * needed to issue the refund by hand.
 */
export function buildRefundFailureEmail(input: {
  projectName: string;
  memberName: string;
  memberEmail: string | null;
  membershipId: string;
  paymentIntentId: string | null;
  intendedAmount: number | null;
  currency: string;
  error: string;
}): { subject: string; text: string } {
  const amount =
    input.intendedAmount === null
      ? "unknown"
      : `${input.intendedAmount.toFixed(2)} ${input.currency}`;

  return {
    subject: `[${input.projectName}] Transfer refund FAILED — ${input.memberName} is owed money`,
    text: [
      `A membership transfer completed, but refunding the member who gave up their`,
      `membership failed. The transfer went through regardless, so this person has`,
      `lost their membership and has NOT been paid. This needs a manual refund.`,
      ``,
      `Member:          ${input.memberName}`,
      `Email:           ${input.memberEmail ?? "unknown"}`,
      `Amount owed:     ${amount}`,
      `Payment intent:  ${input.paymentIntentId ?? "none recorded"}`,
      `Membership id:   ${input.membershipId}`,
      ``,
      `Stripe error:    ${input.error}`,
      ``,
      `To refund by hand, open the payment intent in the Stripe dashboard and`,
      `refund the amount above. Then correct refund_amount on the matching row in`,
      `burn_membership_transfers and clear its metadata.refund_failed flag.`,
      ``,
      `Outstanding cases can be listed with:`,
      `  select * from burn_membership_transfers where metadata->>'refund_failed' = 'true';`,
    ].join("\n"),
  };
}
