import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/utils/auth/verifyToken";
import { SSO_COOKIE_NAME, clearTokenCookie } from "@/utils/auth/cookies";
import { establishSupabaseSession } from "@/utils/auth/supabaseSession";

export async function GET(request: NextRequest) {
  const ssoCookieDomain = process.env.SSO_COOKIE_DOMAIN;
  if (!ssoCookieDomain) {
    console.log("[SSO_INFO] SSO cookie domain not configured, redirecting to home");
    return NextResponse.redirect(new URL("/", request.url));
  }

  const ssoToken = request.cookies.get(SSO_COOKIE_NAME)?.value;
  if (!ssoToken) {
    console.log("[SSO_INFO] No SSO token found, redirecting to home");
    return NextResponse.redirect(new URL("/", request.url));
  }

  try {
    // Verify the SSO token with proper JWT validation
    const verificationResult = await verifyToken(ssoToken);

    if (!verificationResult.success || !verificationResult.user) {
      console.error("[SSO_ERROR] Token verification failed", {
        errorCode: "sso_token_verification_failed",
        error: verificationResult.error,
      });
      throw new Error(
        `SSO token verification failed: ${verificationResult.error}`,
      );
    }

    const { email } = verificationResult.user;
    console.log("[SSO_SUCCESS] Token verified successfully", { email });

    // Establish Supabase session for this user
    const response = NextResponse.redirect(new URL("/", request.url));
    const sessionError = await establishSupabaseSession(email, request, response);

    if (sessionError) {
      throw new Error(sessionError);
    }

    console.log("[SSO_SUCCESS] Session established successfully", { email });
    return response;
  } catch (error) {
    console.error("[SSO_ERROR] SSO authentication failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Delete the stale SSO cookie and redirect to home
    const response = NextResponse.redirect(new URL("/", request.url));
    clearTokenCookie(response);
    return response;
  }
}
