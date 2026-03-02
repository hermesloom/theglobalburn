import {
  requestWithAuthAdmin,
  query,
  getUserIdByEmail,
} from "@/app/api/_common/endpoints";
import { NextResponse } from "next/server";
import { s } from "ajv-ts";

export const GET = requestWithAuthAdmin(async (supabase, _user) => {
  return {
    data: await query(() =>
      supabase
        .from("role_assignments")
        .select("*, profiles(email), roles(name, projects(name))")
    ),
    roles: await query(() =>
      supabase.from("roles").select("*, projects(name)")
    ),
  };
});

const CreateRoleAssignmentRequestSchema = s.object({
  email: s.string(),
  roleId: s.string(),
});

export const POST = requestWithAuthAdmin<
  s.infer<typeof CreateRoleAssignmentRequestSchema>
>(async (supabase, profile, request, body) => {
  const { email, roleId } = body;

  const userId = await getUserIdByEmail(supabase, email);
  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return query(() =>
    supabase
      .from("role_assignments")
      .insert({ user_id: userId, role_id: roleId })
  );
}, CreateRoleAssignmentRequestSchema);
