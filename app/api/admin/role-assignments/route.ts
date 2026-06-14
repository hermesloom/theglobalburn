import {
  requestWithAuthAdmin,
  query,
  getUserIdByEmail,
} from "@/app/api/_common/endpoints";
import { NextResponse } from "next/server";
import { s } from "ajv-ts";

export const GET = requestWithAuthAdmin(async (supabase, _user, request) => {
  const { searchParams } = new URL(request.url);
  const roleId = searchParams.get("roleId");

  return {
    data: await query(() => {
      let q = supabase
        .from("role_assignments")
        .select("*, profiles(email), roles(name, projects(name))");
      if (roleId) q = q.eq("role_id", roleId);
      return q;
    }),
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
