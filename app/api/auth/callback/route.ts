import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/utils/auth/verifyToken";
import { setTokenCookie } from "@/utils/auth/cookies";
import { establishSupabaseSession } from "@/utils/auth/supabaseSession";

/**
 * OAuth callback route for handling authorization code from OpenAuth server.
 *
 * Flow:
 * 1. Receive authorization code from OAuth server
 * 2. Exchange code for access token
 * 3. Verify token and get user info from OAuth server
 * 4. Create/update user in Supabase
 * 5. Establish Supabase session
 * 6. Set SSO cookie for cross-subdomain authentication
 * 7. Redirect to original destination
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");


  // Handle OAuth errors
  if (error) {
    console.error("OAuth error:", error, searchParams.get("error_description"));
    return NextResponse.redirect(new URL("/?error=auth_failed", request.url));
  }

  if (!code) {
    console.error("No authorization code received");
    return NextResponse.redirect(new URL("/?error=no_code", request.url));
  }

  // Verify state parameter for CSRF protection
  const storedState = request.cookies.get("oauth_state")?.value;
  if (!storedState || storedState !== state) {
    console.error("[AUTH_ERROR] State mismatch - possible CSRF attack", {
      errorCode: "invalid_state",
      hasStoredState: !!storedState,
      statesMatch: storedState === state,
    });
    return NextResponse.redirect(new URL("/?error=invalid_state", request.url));
  }

  // Get PKCE verifier from cookie
  const codeVerifier = request.cookies.get("pkce_verifier")?.value;
  if (!codeVerifier) {
    console.error("[AUTH_ERROR] PKCE verifier missing from cookies", {
      errorCode: "pkce_missing",
    });
    return NextResponse.redirect(new URL("/?error=auth_failed", request.url));
  }

  const oauthUrl = process.env.BORDERLAND_OAUTH_URL;
  const clientId = process.env.BORDERLAND_OAUTH_CLIENT_ID;
  const redirectUri = process.env.OAUTH_REDIRECT_URI;

  if (!oauthUrl || !clientId || !redirectUri) {
    console.error("[AUTH_ERROR] OAuth configuration missing", {
      errorCode: "config_error",
      oauthUrl: !!oauthUrl,
      clientId: !!clientId,
      redirectUri: !!redirectUri,
    });
    return NextResponse.redirect(new URL("/?error=config_error", request.url));
  }

  try {
    // Step 1: Exchange authorization code for access token (with PKCE)
    const tokenResponse = await fetch(`${oauthUrl}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("[AUTH_ERROR] Token exchange failed", {
        errorCode: "token_exchange_failed",
        status: tokenResponse.status,
        error: errorText,
      });
      return NextResponse.redirect(new URL("/?error=auth_failed", request.url));
    }

    const tokenData = await tokenResponse.json();
    console.log("[AUTH_SUCCESS] Token response received");

    // OpenAuth returns different token types - try to get the access token
    const accessToken = tokenData.access_token || tokenData.token;

    if (!accessToken) {
      console.error("[AUTH_ERROR] No access token in response", {
        errorCode: "no_access_token",
        tokenDataKeys: Object.keys(tokenData),
      });
      return NextResponse.redirect(new URL("/?error=auth_failed", request.url));
    }

    // Step 2: Verify the JWT and get user info
    const verificationResult = await verifyToken(accessToken);

    if (!verificationResult.success || !verificationResult.user) {
      console.error("[AUTH_ERROR] Token verification failed", {
        errorCode: "token_verification_failed",
        error: verificationResult.error,
      });
      return NextResponse.redirect(new URL("/?error=auth_failed", request.url));
    }

    const { email } = verificationResult.user;
    console.log("[AUTH_SUCCESS] Token verified successfully", { email });

    // Steps 3-5: Create/update user in Supabase and establish session
    const response = NextResponse.redirect(new URL("/", request.url));
    const sessionError = await establishSupabaseSession(email, request, response);

    if (sessionError) {
      return NextResponse.redirect(new URL("/?error=auth_failed", request.url));
    }

    console.log("[AUTH_SUCCESS] Supabase session established", { email });

    // Step 6: Set SSO cookie for cross-subdomain authentication
    setTokenCookie(response, accessToken);

    // Clear the OAuth state and PKCE verifier cookies
    response.cookies.delete("oauth_state");
    response.cookies.delete("pkce_verifier");

    console.log("[AUTH_SUCCESS] OAuth callback completed successfully", { email });

    return response;
  } catch (error) {
    console.error("[AUTH_ERROR] OAuth callback failed with unexpected error", {
      errorCode: "unexpected_error",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.redirect(new URL("/?error=auth_failed", request.url));
  }
}
