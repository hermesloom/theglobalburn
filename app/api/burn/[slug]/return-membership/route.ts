import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { s } from "ajv-ts";
import { BurnRole, BurnStage } from "@/utils/types";
import Stripe from "stripe";

const ReturnMembershipRequestSchema = s.object({
  email: s.string(),
  confirmReturn: s.string(),
});

export const POST = requestWithProject<
  s.infer<typeof ReturnMembershipRequestSchema>
>(
  async (supabase, profile, request, body, project) => {
    // check if any more transfers are allowed
    if (
      +new Date(project!.burn_config.last_possible_transfer_at) < +new Date()
    ) {
      throw new Error(`No further returns are possible`);
    }

    // check if the user has a membership to transfer
    if (!project!.membership) {
      throw new Error(`User has no memberships to transfer`);
    }

    if (body.confirmReturn !== "I WANT TO RETURN MY MEMBERSHIP") {
      throw new Error(`Confirmation string does not match`);
    }

    // refund the current membership via Stripe
    if (project!.membership.stripe_payment_intent_id) {
      const stripe = new Stripe(project!.burn_config.stripe_secret_api_key);
      await stripe.refunds.create({
        payment_intent: project!.membership.stripe_payment_intent_id,
      });
    }

    // delete the current membership
    await query(() =>
      supabase
        .from("burn_memberships")
        .delete()
        .eq("id", project!.membership!.id),
    );
  },
  ReturnMembershipRequestSchema,
  BurnRole.Participant,
);
