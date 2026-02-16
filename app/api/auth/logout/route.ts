import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { clearTokenCookie } from "@/utils/auth/cookies";

/**
 * POST endpoint for logout.
 * Returns JSON response.
 */
export function POST(_request: NextRequest) {
  return performLogout(NextResponse.json({ success: true }))
    .catch(() => NextResponse.json({ error: "Logout failed" }, { status: 500 }));
}

/**
 * GET endpoint for logout redirect.
 * Useful for direct browser navigation.
 */
export function GET(request: NextRequest) {
  return performLogout(NextResponse.redirect(new URL("/", request.url)))
    .catch(() => NextResponse.redirect(new URL("/?error=logout_failed", request.url)));
}

/**
 * Shared logout logic.
 * Clears Supabase session and SSO cookie.
 * Returns the response on success, throws on failure.
 */
async function performLogout(response: NextResponse): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    clearTokenCookie(response);
    console.log("[LOGOUT_SUCCESS] User logged out successfully");
    return response;
  } catch (error) {
    console.error("[LOGOUT_ERROR] Logout failed", {
      errorCode: "logout_failed",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
