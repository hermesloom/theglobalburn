import { createServerClient, type CookieOptions } from "@supabase/ssr";
import {
  createClient as createSupabaseClient,
  SupabaseClient,
  User,
} from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/** Creates a Supabase client for route handlers (e.g. auth callback) that can write cookies. Use anon key for user auth. */
export async function createRouteHandlerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

/**
 * A service role client with no user session attached.
 *
 * createClient() is built from cookies, so once a user is signed in @supabase/ssr
 * sends their access token as the Authorization header. PostgREST then runs the
 * query as `authenticated` rather than `service_role`, and row level security
 * applies - which for tables with RLS enabled and no policies means every query
 * silently returns zero rows. That is a trap: it looks like missing data, not a
 * permissions error.
 *
 * Use this for data access in API routes. Authorization is enforced by the
 * requestWith* wrappers in app/api/_common/endpoints.ts, not by RLS.
 */
export function createAdminClient(): SupabaseClient {
  return createSupabaseClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function getUser(
  supabase: SupabaseClient
): Promise<User | NextResponse> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  return user;
}
