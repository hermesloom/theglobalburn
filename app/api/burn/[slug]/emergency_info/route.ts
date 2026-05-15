import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { s } from "ajv-ts";
import { BurnRole } from "@/utils/types";

const UpdateEmergencyInfoSchema = s.object({
  phone_number: s.string().optional(),
  emergency_contact_onsite: s.string().optional(),
  emergency_contact_other: s.string().optional(),
  camp_name: s.string().optional(),
});

export const PATCH = requestWithProject<
  s.infer<typeof UpdateEmergencyInfoSchema>
>(
  async (supabase, profile, request, body, project) => {
    const newMetaData = project?.membership?.metadata ?? {};
    newMetaData["emergency_info"] = body;

    await query(() =>
      supabase
        .from("burn_memberships")
        .update({ metadata: newMetaData })
        .eq("id", project!.membership!.id),
    );
  },
  UpdateEmergencyInfoSchema,
  BurnRole.Participant,
);
