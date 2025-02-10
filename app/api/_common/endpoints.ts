import { s } from "ajv-ts";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { Profile, Project, BurnRole } from "@/utils/types";
import { getProfile } from "./profile";

export type RequestWithAuthHandler<T = any> = (
  supabase: SupabaseClient,
  profile: Profile,
  request: NextRequest,
  body: T,
  project?: Project
) => Promise<any> | Promise<NextResponse>;

export function requestWithAuth<T = any>(
  handler: RequestWithAuthHandler<T>,
  schema?: s.Object
) {
  return async (req: NextRequest) => {
    const supabase = await createClient();
    const { data: getUserData } = await supabase.auth.getUser();

    const userId = getUserData?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const profile = await getProfile(supabase, userId);

    try {
      let body: T = {} as T;
      if (schema) {
        body = await req.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: "Invalid request body: " + parsed.error },
            { status: 422 }
          );
        }
        body = <T>parsed.data;
      }

      const response = await handler(supabase, profile, req, body);
      if (response instanceof NextResponse) {
        return response;
      }
      return NextResponse.json(response ?? {});
    } catch (error: any) {
      console.error("Error processing request:", error);
      if (error.message) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 }
      );
    }
  };
}

export function requestWithAuthAdmin<T = any>(
  handler: RequestWithAuthHandler<T>,
  schema?: s.Object
) {
  return requestWithAuth(async (supabase, profile, req, body) => {
    if (!profile.is_admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    return handler(supabase, profile, req, body);
  }, schema);
}

export function requestWithProject<T = any>(
  handler: RequestWithAuthHandler<T>,
  schema?: s.Object,
  role?: BurnRole
) {
  return requestWithAuth(async (supabase, profile, req, body) => {
    const projectSlug = req.nextUrl.pathname.split("/")[3];
    const project = profile.projects.find((p) => p.slug === projectSlug);
    if (!project) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (role && !project.roles.includes(role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    return await handler(supabase, profile, req, body, project);
  }, schema);
}

export async function query(fn: () => any): Promise<any> {
  const { data, error } = await fn();

  if (error) {
    console.log(error);
    throw new Error("Failed to execute query");
  }

  return data;
}

export async function getUserIdByEmail(
  supabase: SupabaseClient,
  email: string
) {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();
  return data?.id;
}

export async function getProjectQuestions(supabase: SupabaseClient) {
  const { data } = await supabase.from("questions").select("*");
  return data;
}