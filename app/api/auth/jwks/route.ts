import { NextResponse } from "next/server";
import * as jose from "jose";

/**
 * JWKS (JSON Web Key Set) endpoint
 * Serves the public key for REA to verify JWT signatures
 *
 * @see JWT_AUTH_SETUP.md for setup instructions
 */
export async function GET() {
  try {
    const publicKeyPEM = process.env.JWT_PUBLIC_KEY;
    const reaUrl = process.env.NEXT_PUBLIC_REA_URL || "https://rea.theborderland.se";

    if (!publicKeyPEM) {
      console.error("JWT_PUBLIC_KEY environment variable not configured");
      return NextResponse.json(
        { error: "JWT public key not configured" },
        { status: 500 }
      );
    }

    // Import the PEM public key
    const publicKey = await jose.importSPKI(publicKeyPEM, "RS256");

    // Export as JWK (JSON Web Key)
    const jwk = await jose.exportJWK(publicKey);

    // Return JWKS format (array of keys) with CORS headers
    const response = NextResponse.json({
      keys: [
        {
          ...jwk,
          kid: "theglobalburn-jwt-key", // Key ID
          use: "sig", // Usage: signature
          alg: "RS256", // Algorithm
        },
      ],
    });

    // Add CORS headers to allow REA to fetch the public key
    const reaOrigin = new URL(reaUrl).origin;
    response.headers.set("Access-Control-Allow-Origin", reaOrigin);
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
    response.headers.set("Cache-Control", "public, max-age=3600"); // Cache for 1 hour

    return response;
  } catch (error) {
    console.error("Error generating JWKS:", error);
    return NextResponse.json(
      { error: "Failed to generate JWKS" },
      { status: 500 }
    );
  }
}

// Handle preflight requests
export async function OPTIONS() {
  const reaUrl = process.env.NEXT_PUBLIC_REA_URL || "https://rea.theborderland.se";
  const reaOrigin = new URL(reaUrl).origin;

  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Access-Control-Allow-Origin", reaOrigin);
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");

  return response;
}
