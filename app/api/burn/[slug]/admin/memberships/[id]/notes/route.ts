import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { BurnRole } from "@/utils/types";
import s from "ajv-ts";

const NoteSchema = s.object({ note: s.string() });

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
      }),
    );
  },
  NoteSchema,
  BurnRole.MembershipLead,
);
