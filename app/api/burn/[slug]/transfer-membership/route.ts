import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { s } from "ajv-ts";
import { BurnRole, BurnStage } from "@/utils/types";
import {
  getProfileByEmail,
  validateNewMembershipEligibility,
  getAvailableMemberships,
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
    const recipientProfile = await getProfileByEmail(
      supabase,
      body.email.toLowerCase(),
    );
    const recipientProject = validateNewMembershipEligibility(
      recipientProfile,
      project!,
    );

    // Determine if the transferred membership should be low income:
    // - If the original membership was low income, the recipient must also have a low income lottery ticket
    // - If the original membership was not low income, but the recipient has a low income lottery ticket,
    //   check if there are still low income spots available that they can use
    let isLowIncome = false;
    if (project!.membership?.is_low_income) {
      if (recipientProject.lottery_ticket?.is_low_income) {
        isLowIncome = true;
      }
    } else {
      if (recipientProject.lottery_ticket?.is_low_income) {
        const { lowIncomeAvailable } = await getAvailableMemberships(
          supabase,
          recipientProject,
        );
        isLowIncome = lowIncomeAvailable;
      }
    }

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
