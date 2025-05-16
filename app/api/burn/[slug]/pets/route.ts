import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { s } from "ajv-ts";
import { BurnRole } from "@/utils/types";

const UpdatePetRequestSchema = s.object({
  pets: s.array(
    s.object({
      key: s.string(),
      first_name: s.string(),
      last_name: s.string(),
      dob: s.string(),
    }),
  ),
});

export const PATCH = requestWithProject<
  s.infer<typeof UpdatePetRequestSchema>
>(
  async (supabase, profile, request, body, project) => {
    const newMetaData = project?.membership?.metadata ?? {};

    if (newMetaData["pets"] === undefined) {
      newMetaData["pets"] = [];
    }
    newMetaData["pets"] = body.pets;

    await query(() =>
      supabase
        .from("burn_memberships")
        .update({ metadata: newMetaData })
        .eq("id", project!.membership!.id),
    );
  },
  UpdatePetRequestSchema,
  BurnRole.Participant,
);

