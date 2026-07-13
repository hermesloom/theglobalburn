import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { BurnRole } from "@/utils/types";
import s from "ajv-ts";

const NoteSchema = s.object({ note: s.string(), special_circumstances: s.boolean().optional() });

export const POST = requestWithProject(
  async (supabase, profile, request, body, project) => {
    const parts = request.nextUrl.pathname.split("/");
    const membershipId = parts[parts.length - 2];
    return await query(() =>
      supabase.from("burn_membership_notes").insert({
        project_id: project!.id,
        membership_id: membershipId,
        actor_profile_id: profile.id,
        note: body.note,
        special_circumstances: body.special_circumstances ?? false,
      }),
    );
  },
  NoteSchema,
  BurnRole.MembershipLead,
);
