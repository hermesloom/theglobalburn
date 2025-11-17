import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { s } from "ajv-ts";
import { BurnRole } from "@/utils/types";
import { checkNoSuchMembershipOrPurchaseRightExists } from "@/app/api/_common/profile";
import { sendEmail } from "../../../../_components/email";

const SetMembershipPurchaseRightDetailsRequestSchema = s.object({
  first_name: s.string(),
  last_name: s.string(),
  birthdate: s.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
});

type ExcludedIndividual = Partial<
  s.infer<typeof SetMembershipPurchaseRightDetailsRequestSchema>
>;

const excludedIndividuals: ExcludedIndividual[] = JSON.parse(
  process.env.EXCLUDED_INDIVIDUALS ?? "[]",
);

export const PATCH = requestWithProject<
  s.infer<typeof SetMembershipPurchaseRightDetailsRequestSchema>
>(
  async (supabase, profile, request, body, project) => {
    if (!project!.membership_purchase_right) {
      throw new Error("No membership purchase right found");
    }

    if (!project?.membership_purchase_right.details_modifiable) {
      throw new Error("Details are not modifiable");
    }

    await checkNoSuchMembershipOrPurchaseRightExists(
      supabase,
      project!.id,
      body.first_name,
      body.last_name,
      body.birthdate,
    );

    if (
      excludedIndividuals.some((excludedIndividual) =>
        (Object.keys(excludedIndividual) as (keyof ExcludedIndividual)[]).every(
          (k) =>
            excludedIndividual[k] === undefined ||
            body[k].toLowerCase() === excludedIndividual[k].toLowerCase(),
        ),
      )
    ) {
      await sendEmail(
        process.env.BOARD_EMAIL!,
        "Warning: " +
          body.first_name +
          " " +
          body.last_name +
          " just tried to acquire a membership!",
        `Dear board,\n\nThis is to inform you that **${body.first_name} ${body.last_name}** has just tried to enter their personal details in the membership platform to acquire a membership, but has been prevented from doing so through an error message.\n\nNote that this individual, registered in the platform as ${profile.email}, currently has an active membership purchase right which can be revoked by an admin. Alternatively, it will automatically expire at ${project.membership_purchase_right.expires_at}.\n\nThis email has been generated automatically.\n\nBest regards\nMembership platform for ${project.name}`,
      );
      throw new Error(
        `You have been formally excluded from ${project.name}. The board has been informed of your attempt to sign up anyway. If this doesn't seem right, please contact support via the email address at the bottom.`,
      );
    }

    await query(() =>
      supabase
        .from("burn_membership_purchase_rights")
        .update({
          first_name: body.first_name,
          last_name: body.last_name,
          birthdate: body.birthdate,
          details_modifiable: false,
        })
        .eq("id", project!.membership_purchase_right!.id),
    );
  },
  SetMembershipPurchaseRightDetailsRequestSchema,
  BurnRole.Participant,
);
