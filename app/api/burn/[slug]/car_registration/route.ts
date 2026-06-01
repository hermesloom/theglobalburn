import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { s } from "ajv-ts";
import { BurnRole } from "@/utils/types";

const UpdateCarRegistrationSchema = s.object({
  phone_number: s.string().optional(),
  alt_contact: s.string().optional(),
  camp_or_area: s.string().optional(),
  registration_plate: s.string().optional(),
});

export const PATCH = requestWithProject<
  s.infer<typeof UpdateCarRegistrationSchema>
>(
  async (supabase, profile, request, body, project) => {
    const newMetaData = project?.membership?.metadata ?? {};
    newMetaData["car_registration"] = body;

    await query(() =>
      supabase
        .from("burn_memberships")
        .update({ metadata: newMetaData })
        .eq("id", project!.membership!.id),
    );
  },
  UpdateCarRegistrationSchema,
  BurnRole.Participant,
);
