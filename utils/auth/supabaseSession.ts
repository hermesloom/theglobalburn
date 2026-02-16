import { createServerClient } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

/**
 * Find or create a Supabase auth user by email, then establish a Supabase
 * session and write the session cookies onto the given response object.
 *
 * This is needed because the rest of the app (SessionContext, API route guards,
 * middleware) still depends on a Supabase session — the external OAuth server
 * only handles identity verification, not session storage.
 *
 * Returns an error string on failure, or null on success.
 */
export async function establishSupabaseSession(
  email: string,
  request: NextRequest,
  response: NextResponse,
): Promise<string | null> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error("[SUPABASE_SESSION_ERROR] Supabase configuration missing");
    return "Supabase configuration missing";
  }

  // Use the service role client to upsert the user and generate a token.
  // The service role bypasses RLS and can create users without sending email.
  const adminClient = createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Create the user if they don't already exist
  const { error: upsertError } = await adminClient.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  // Ignore "already registered" — that's the happy path for returning users
  if (upsertError && !upsertError.message.includes("already been registered")) {
    console.error("[SUPABASE_SESSION_ERROR] Failed to upsert user", {
      email,
      error: upsertError.message,
    });
    return upsertError.message;
  }

  // Generate a magic link token via the admin API. This gives us a token we
  // can exchange for a real session without sending any email.
  const { data: linkData, error: linkError } =
    await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

  if (linkError || !linkData?.properties?.hashed_token) {
    console.error("[SUPABASE_SESSION_ERROR] Failed to generate session token", {
      email,
      error: linkError?.message,
    });
    return linkError?.message ?? "Failed to generate session token";
  }

  // Exchange the token for a session using an SSR client that writes cookies
  // directly onto the response object.
  const ssrClient = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error: verifyError } = await ssrClient.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });

  if (verifyError) {
    console.error("[SUPABASE_SESSION_ERROR] Failed to establish session", {
      email,
      error: verifyError.message,
    });
    return verifyError.message;
  }

  return null;
}
