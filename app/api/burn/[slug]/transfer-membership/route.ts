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
});

export const POST = requestWithProject<
  s.infer<typeof TransferMembershipRequestSchema>
>(
  async (supabase, profile, request, body, project) => {
    // check if any more transfers are allowed
    if (
      +new Date(project!.burn_config.last_possible_transfer_at) < +new Date()
    ) {
      throw new Error(`No further transfers are possible`);
    }

    // check if the user has a membership to transfer
    if (!project!.membership) {
      throw new Error(`User has no memberships to transfer`);
    }

    // check that the recipient is registered, part of this project and has no membership and no membership purchase right yet
    const recipientProfile = await getProfileByEmail(supabase, body.email);
    const recipientProject = validateNewMembershipEligibility(
      recipientProfile,
      project!,
    );

    // create a membership purchase right for the recipient
    const purchaseRight = await query(() =>
      supabase
        .from("burn_membership_purchase_rights")
        .insert({
          project_id: project!.id,
          owner_id: recipientProfile.id,
          expires_at: new Date(
            +new Date() +
              recipientProject.burn_config.transfer_reservation_duration * 1000,
          ).toISOString(),
          is_low_income: recipientProject.lottery_ticket?.is_low_income,
          details_modifiable: true,
        })
        .select()
        .single(),
    );

    // mark the current membership as being transferred to the recipient
    await query(() =>
      supabase
        .from("burn_memberships")
        .update({
          is_being_transferred_to: purchaseRight.id,
        })
        .eq("id", project!.membership!.id),
    );
  },
  TransferMembershipRequestSchema,
  BurnRole.Participant,
);
