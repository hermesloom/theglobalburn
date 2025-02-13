import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { s } from "ajv-ts";
import { BurnRole } from "@/utils/types";

const UpdateChildRequestSchema = s.object({
  children: s.array(
    s.object({
      key: s.string(),
      first_name: s.string(),
      last_name: s.string(),
      dob: s.string(),
    }),
  ),
});

export const PATCH = requestWithProject<
  s.infer<typeof UpdateChildRequestSchema>
>(
  async (supabase, profile, request, body, project) => {
    const newMetaData = project?.membership?.metadata;

    if (newMetaData["children"] === undefined) {
      newMetaData["children"] = [];
    }
    newMetaData["children"] = body.children;

    await query(() =>
      supabase
        .from("burn_memberships")
        .update({ metadata: newMetaData })
        .eq("id", project!.membership!.id),
    );
  },
  UpdateChildRequestSchema,
  BurnRole.Participant,
);
