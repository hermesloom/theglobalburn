import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { s } from "ajv-ts";
import { BurnRole, BurnStage } from "@/utils/types";
import {
  getProfileByEmail,
  validateNewMembershipEligibility,
} from "@/app/api/_common/profile";
import Stripe from "stripe";

const TransferMembershipRequestSchema = s.object({
  email: s.string(),
  confirmTransfer: s.string(),
});

export const POST = requestWithProject<
  s.infer<typeof TransferMembershipRequestSchema>
>(
  async (supabase, profile, request, body, project) => {
    if (project?.burn_config.current_stage !== BurnStage.OpenSaleGeneral) {
      throw new Error(
        `Expected burn stage to be ${BurnStage.OpenSaleGeneral}, got ${project?.burn_config.current_stage}`,
      );
    }

    // check if any more transfers are allowed
    if (
      +new Date(project.burn_config.last_possible_transfer_at) < +new Date()
    ) {
      throw new Error(`No further transfers are possible`);
    }

    // check if the user has a membership to transfer
    if (!project.membership) {
      throw new Error(`User has no memberships to transfer`);
    }
    if (body.confirmTransfer !== "I WANT TO TRANSFER MY MEMBERSHIP") {
      throw new Error(`Confirmation string does not match`);
    }
    // check that the recipient is registered, part of this project and has no membership and no membership purchase right yet
    const recipientProfile = await getProfileByEmail(supabase, body.email);
    const recipientProject = validateNewMembershipEligibility(
      recipientProfile,
      project!,
    );

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

    // create a membership purchase right for the recipient
    await query(() =>
      supabase.from("burn_membership_purchase_rights").insert({
        project_id: project!.id,
        owner_id: recipientProfile.id,
        expires_at: new Date(
          +new Date() +
            recipientProject.burn_config.transfer_reservation_duration * 1000,
        ).toISOString(),
        is_low_income: false,
        details_modifiable: true,
      }),
    );
  },
  TransferMembershipRequestSchema,
  BurnRole.Participant,
);
