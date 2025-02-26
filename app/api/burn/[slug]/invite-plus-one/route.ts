import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { s } from "ajv-ts";
import { BurnRole, BurnStage } from "@/utils/types";
import {
  getProfileByEmail,
  validateNewMembershipEligibility,
} from "@/app/api/_common/profile";

const InvitePlusOneRequestSchema = s.object({
  email: s.string(),
});

export const POST = requestWithProject<
  s.infer<typeof InvitePlusOneRequestSchema>
>(
  async (supabase, profile, request, body, project) => {
    if (project?.burn_config.current_stage !== BurnStage.LotteryClosed) {
      throw new Error(
        `Expected burn stage to be lottery-closed, got ${project?.burn_config.current_stage}`,
      );
    }

    const recipientProfile = await getProfileByEmail(
      supabase,
      body.email.toLowerCase(),
    );
    const recipientProject = validateNewMembershipEligibility(
      recipientProfile,
      project!,
    );

    // create a membership purchase right for the recipient
    await query(() =>
      supabase.from("burn_membership_purchase_rights").insert({
        project_id: project!.id,
        owner_id: recipientProfile.id,
        expires_at: new Date(
          +new Date() +
            project?.burn_config.plus_one_reservation_duration! * 1000,
        ).toISOString(),
        is_low_income: recipientProject.lottery_ticket?.is_low_income ?? false,
        details_modifiable: true,
      }),
    );

    // set "can_invite_plus_one" to false for the lottery ticket,
    // so that the user can't invite another +1
    await query(() =>
      supabase
        .from("burn_lottery_tickets")
        .update({ can_invite_plus_one: false })
        .eq("id", project!.lottery_ticket!.id),
    );
  },
  InvitePlusOneRequestSchema,
  BurnRole.Participant,
);
