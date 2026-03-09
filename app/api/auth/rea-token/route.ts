import { requestWithAuth } from "@/app/api/_common/endpoints";
import * as jose from "jose";

/**
 * REA Token Generation API
 * Generates a JWT token for the authenticated user to access REA
 *
 * @see JWT_AUTH_SETUP.md for setup instructions
 */
export const GET = requestWithAuth(async (supabase, profile, req) => {
  try {
    const privateKeyPEM = process.env.JWT_PRIVATE_KEY;
    const reaUrl = process.env.NEXT_PUBLIC_REA_URL || "https://rea.theborderland.se";

    if (!privateKeyPEM) {
      console.error("JWT_PRIVATE_KEY environment variable not configured");
      throw new Error("Authentication configuration error");
    }

    if (!profile.email) {
      console.error("User profile missing email:", profile.id);
      throw new Error("User profile incomplete");
    }

    // Get burn slug from query parameter
    const burnSlug = req.nextUrl.searchParams.get("burn");
    let firstName: string | undefined;
    let lastName: string | undefined;

    if (burnSlug) {
      // Find the project for this burn
      const project = profile.projects.find((p) => p.slug === burnSlug);

      if (project?.membership) {
        firstName = project.membership.first_name;
        lastName = project.membership.last_name;
      }
    }

    // Import the private key
    const privateKey = await jose.importPKCS8(privateKeyPEM, "RS256");

    // Create JWT with 2 minute expiration and audience claim
    // Token is just used by the embedded service to know that the email
    // is authorized and then that service is responsible for logging that
    // email in and setting it's own cookies to preserve the session
    const token = await new jose.SignJWT({
      email: profile.email,
      hasMembership: !!project.membership,
      firstName,
      lastName,
    })
      .setProtectedHeader({ alg: "RS256", kid: "theglobalburn-jwt-key" })
      .setIssuedAt()
      .setIssuer("theglobalburn")
      .setAudience(reaUrl) // Add audience claim
      .setExpirationTime("2m") // Short-lived token for initial auth
      .sign(privateKey);

    return { token };
  } catch (error: any) {
    // Log detailed error server-side
    console.error("Error generating REA token:", error);

    // Return sanitized error to client (don't leak sensitive details)
    throw new Error("Failed to generate authentication token");
  }
});
