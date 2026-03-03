# JWT Authentication Setup for REA Integration

This document describes how to set up JWT-based authentication between theglobalburn and the Realities Employment Agency (REA) app.

## Overview

- **theglobalburn** issues RS256-signed JWTs containing user information
- **REA** verifies JWT signatures using theglobalburn's public key
- Users authenticated in theglobalburn are automatically logged into REA via iframe

## Setup Instructions

### 1. Generate RSA Key Pair

Generate a 2048-bit RSA key pair for JWT signing:

```bash
# Generate private key
openssl genrsa -out jwt_private_key.pem 2048

# Generate public key from private key
openssl rsa -in jwt_private_key.pem -pubout -out jwt_public_key.pem
```

### 2. Configure Environment Variables

Add the following to your `.env.local` file:

```bash
# REA Application URL (used for iframe src and JWT audience claim)
NEXT_PUBLIC_REA_URL=https://rea.theborderland.se

# For local development:
# NEXT_PUBLIC_REA_URL=http://localhost:4000

# JWT Private Key (for signing tokens)
# Copy the entire contents of jwt_private_key.pem
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
...
-----END PRIVATE KEY-----"

# JWT Public Key (for serving via JWKS endpoint)
# Copy the entire contents of jwt_public_key.pem
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvP...
...
-----END PUBLIC KEY-----"
```

**Important**: Keep `jwt_private_key.pem` secure and never commit it to version control. The public key can be shared safely.

### 3. Environment Template

The `.env.template` file has been updated with placeholders for JWT configuration:

```bash
# JWT Authentication for REA Integration
NEXT_PUBLIC_REA_URL=https://rea.theborderland.se
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

**Note**: When copying your actual keys, preserve the line breaks or use `\n` in the string.

## How It Works

1. User navigates to `/burn/[slug]/rea` page in theglobalburn
2. Page calls `/api/auth/rea-token` to generate a JWT containing user's email and audience claim
3. JWT is appended to REA iframe URL as query parameter: `?token={jwt}`
4. REA's JWT auth plug intercepts the request and extracts the token
5. REA fetches theglobalburn's public key from `/api/auth/jwks` (with CORS headers)
6. REA verifies the JWT signature, expiration (2 minutes), and audience claim
7. REA creates or finds user by email and establishes Pow session
8. REA redirects to clean URL (removes token from browser history)
9. User is automatically authenticated in the embedded REA iframe

### Security Features

- **Short-Lived Tokens**: 2-minute expiration minimizes risk of token exposure in URLs/logs
- **Single-Use Pattern**: Token consumed immediately to create session, then discarded
- **Audience Claim**: JWT includes `aud` claim to ensure tokens are only valid for REA
- **CORS Protection**: JWKS endpoint has explicit CORS headers for REA domain only
- **Error Sanitization**: Detailed errors are logged server-side but generic messages sent to client
- **Automatic Cleanup**: Token removed from URL after verification

## API Endpoints

### `GET /api/auth/jwks`

Returns the public key in JWKS (JSON Web Key Set) format for REA to verify tokens.

**Response:**

```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "kid": "theglobalburn-jwt-key",
      "n": "...",
      "e": "AQAB"
    }
  ]
}
```

### `GET /api/auth/rea-token`

Generates a JWT for the currently authenticated user.

**Requires:** Valid Supabase session

**Response:**

```json
{
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**JWT Claims:**

- `email`: User's email address
- `iss`: "theglobalburn"
- `iat`: Issued at timestamp
- `exp`: Expiration timestamp (1 hour from issue)

## Security Considerations

- Tokens expire after 1 hour
- RS256 asymmetric signing prevents REA from forging tokens
- Private key must be kept secure
- HTTPS required in production
- Tokens are single-use and removed from URL after verification

## Troubleshooting

### Token verification fails

- Check that JWT_PRIVATE_KEY and JWT_PUBLIC_KEY match the generated key pair
- Ensure keys include the BEGIN/END markers
- Verify REA is fetching from the correct JWKS URL

### User not logged in

- Check that user has a valid Supabase session before requesting token
- Verify email exists in user profile
- Check JWT expiration hasn't passed

## Key Rotation

To rotate keys:

1. Generate new key pair using the commands above
2. Update JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables
3. Restart theglobalburn application
4. Restart REA application (it will fetch new public key from JWKS endpoint)
5. Old tokens will become invalid immediately
