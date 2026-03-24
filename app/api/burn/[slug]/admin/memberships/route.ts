import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { BurnRole } from "@/utils/types";
import { s } from "ajv-ts";
import {
  ensureProfileAndProjectParticipation,
  validateNewMembershipEligibility,
  checkNoSuchMembershipOrPurchaseRightExists,
} from "@/app/api/_common/profile";

export const GET = requestWithProject(
  async (supabase, profile, request, body, project) => {
    return {
      data: await query(() =>
        supabase
          .from("burn_memberships")
          .select("*, profiles(email)")
          .eq("project_id", project!.id)
      ),
    };
  },
  undefined,
  BurnRole.MembershipManager
);

const IssueMembershipRequestSchema = s.object({
  email: s.string(),
  first_name: s.string(),
  last_name: s.string(),
  birthdate: s.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
});

export const POST = requestWithProject<
  s.infer<typeof IssueMembershipRequestSchema>
>(
  async (supabase, profile, request, body, project) => {
    const recipientProfile = await ensureProfileAndProjectParticipation(
      supabase,
      body.email,
      project!,
    );
    validateNewMembershipEligibility(recipientProfile, project!);

    await checkNoSuchMembershipOrPurchaseRightExists(
      supabase,
      project!.id,
      body.first_name,
      body.last_name,
      body.birthdate
    );

    await query(() =>
      supabase.from("burn_memberships").insert({
        project_id: project!.id,
        owner_id: recipientProfile.id,
        first_name: body.first_name,
        last_name: body.last_name,
        birthdate: body.birthdate,
        price: 0,
        price_currency: project?.burn_config.membership_price_currency,
        is_non_transferable: true,
      })
    );
  },
  IssueMembershipRequestSchema,
  BurnRole.MembershipManager
);
