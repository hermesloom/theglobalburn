import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { clearTokenCookie } from "@/utils/auth/cookies";

/**
 * Logout route.
 *
 * Clears Supabase session and SSO cookie.
 */
export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();

    const response = NextResponse.json({ success: true });
    clearTokenCookie(response);

    console.log("[LOGOUT_SUCCESS] User logged out successfully");
    return response;
  } catch (error) {
    console.error("[LOGOUT_ERROR] Logout failed", {
      errorCode: "logout_failed",
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}

/**
 * GET endpoint for logout redirect.
 * Useful for direct browser navigation.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();

    const response = NextResponse.redirect(new URL("/", request.url));
    clearTokenCookie(response);

    console.log("[LOGOUT_SUCCESS] User logged out successfully (redirect)");
    return response;
  } catch (error) {
    console.error("[LOGOUT_ERROR] Logout failed (redirect)", {
      errorCode: "logout_failed",
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.redirect(new URL("/?error=logout_failed", request.url));
  }
}
