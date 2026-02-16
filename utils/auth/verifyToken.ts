import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Verify an OAuth access token using JWKS.
 *
 * This performs JWT signature verification using the OAuth server's public keys:
 * - Cryptographically verifies the token signature using public keys from JWKS
 * - Fast - no network call needed after JWKS keys are cached
 * - Validates token expiration and issuer
 * - Automatic key rotation via JWKS caching
 */

interface VerifiedUser {
  email: string;
  userID: string;
  workspaceID?: string;
}

interface VerifyTokenResult {
  success: boolean;
  user?: VerifiedUser;
  error?: string;
}

/**
 * Verify an access token with cryptographic signature validation.
 *
 * @param token - The access token to verify
 * @returns Verification result with user data if successful
 */
export async function verifyToken(
  token: string,
): Promise<VerifyTokenResult> {
  const oauthUrl = process.env.BORDERLAND_OAUTH_URL;
  if (!oauthUrl) {
    console.error("[TOKEN_VERIFY_ERROR] OAuth server not configured");
    return {
      success: false,
      error: "OAuth server not configured",
    };
  }

  let email: string | unknown | undefined;

  try {
    // OpenAuth follows OIDC conventions: /.well-known/jwks.json
    const jwksUrl = new URL("/.well-known/jwks.json", oauthUrl).toString();
    const JWKS = createRemoteJWKSet(new URL(jwksUrl));

    // Verify the JWT signature, expiration, and claims
    const { payload } = await jwtVerify(token, JWKS, {
      // Verify issuer matches our OAuth server
      issuer: oauthUrl,
      // Allow 60 seconds of clock skew
      clockTolerance: 60,
    });

    // Extract user info from verified token
    email =
      (payload as any).properties?.email ||
      (payload as any).email ||
      payload.sub;

    const userID = (payload as any).properties?.userID || payload.sub;

    const workspaceID = (payload as any).properties?.workspaceID;

    if (!email || !userID) {
      console.error("[TOKEN_VERIFY_ERROR] Missing required claims in token", {
        email: email || undefined,
        hasEmail: !!email,
        hasUserID: !!userID,
      });
      return {
        success: false,
        error: "Token missing required claims",
      };
    }

    console.log("[TOKEN_VERIFY_SUCCESS] Token verified via JWKS", {
      email,
    });

    return {
      success: true,
      user: {
        email: typeof email === "string" ? email : String(email),
        userID: typeof userID === "string" ? userID : String(userID),
        workspaceID:
          typeof workspaceID === "string" ? workspaceID : undefined,
      },
    };
  } catch (error) {
    console.error("[TOKEN_VERIFY_ERROR] JWKS verification failed", {
      email: email || undefined,
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : undefined,
    });
    return {
      success: false,
      error: "Token verification failed - invalid or expired token",
    };
  }
}
