import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";

/**
 * Generate PKCE (Proof Key for Code Exchange) challenge.
 *
 * PKCE protects against authorization code interception attacks.
 * The verifier is stored securely on the server, and the challenge
 * is sent to the OAuth server.
 */
function generatePKCEChallenge() {
  // Generate a cryptographically random code verifier (43-128 chars)
  const codeVerifier = randomBytes(32).toString("base64url");

  // Create SHA-256 hash of the verifier for the challenge
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  return {
    codeVerifier,
    codeChallenge,
  };
}

/**
 * OAuth login initiation route.
 *
 * Redirects user to the OpenAuth server's authorization endpoint.
 * Includes state parameter for CSRF protection and PKCE for enhanced security.
 */
export async function GET(request: NextRequest) {
  const oauthUrl = process.env.BORDERLAND_OAUTH_URL;
  const clientId = process.env.BORDERLAND_OAUTH_CLIENT_ID;
  const redirectUri = process.env.OAUTH_REDIRECT_URI;

  if (!oauthUrl || !clientId || !redirectUri) {
    console.error("OAuth configuration missing:", {
      oauthUrl: !!oauthUrl,
      clientId: !!clientId,
      redirectUri: !!redirectUri,
    });
    return NextResponse.redirect(new URL("/?error=config_error", request.url));
  }

  try {
    // Generate state parameter for CSRF protection
    const state = randomBytes(32).toString("hex");

    // Generate PKCE challenge
    const { codeVerifier, codeChallenge } = generatePKCEChallenge();

    // Build authorization URL with PKCE parameters
    const authUrl = new URL(`${oauthUrl}/authorize`);
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    // Store state and redirect destination in session
    const response = NextResponse.redirect(authUrl.toString());

    // Set session cookies for state and PKCE verifier
    // Both are security-critical and should be httpOnly
    response.cookies.set("oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10, // 10 minutes
      path: "/",
    });

    response.cookies.set("pkce_verifier", codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10, // 10 minutes
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Failed to initiate OAuth login:", error);
    return NextResponse.redirect(new URL("/?error=auth_failed", request.url));
  }
}
