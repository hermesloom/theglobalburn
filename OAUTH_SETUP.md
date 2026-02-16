# OAuth Integration Setup Guide

This application now uses the `@openauthjs/openauth` server for authentication instead of Supabase OTP.

## Architecture Overview

### Authentication Flow

1. User clicks "Sign in with Borderland" in the app
2. App redirects to `/api/auth/login`
3. Login route redirects to OpenAuth server at `oauth.theborderland.se/authorize`
4. User enters email, receives code via email, and verifies
5. OAuth server redirects back to `/api/auth/callback` with authorization code
6. Callback route exchanges code for access token
7. Callback route verifies token and creates/updates user in Supabase
8. Callback route establishes Supabase session and sets SSO cookie
9. User is authenticated in the main app

### SSO Cookie for REA App

- When a user authenticates, a `_borderland_sso` cookie is set with the OAuth access token
- This cookie is set on the shared domain (`.theborderland.se` in production)
- The REA app's `SharedSSO` plug automatically reads this cookie
- When REA detects the cookie, it verifies the token with the OAuth server
- REA creates a local session for the user
- Result: User is automatically authenticated in both apps

## Environment Variables

Add these to your `.env` file:

```bash
# OAuth Configuration (using @openauthjs/openauth server)
BORDERLAND_OAUTH_URL=http://localhost:3000  # Production: https://oauth.theborderland.se
BORDERLAND_OAUTH_CLIENT_ID=your-client-id
OAUTH_REDIRECT_URI=http://localhost:3001/api/auth/callback  # Production: https://theborderland.se/api/auth/callback

# SSO Cookie Domain (for cross-subdomain authentication with REA app)
# Production: .theborderland.se | Development: leave empty
SSO_COOKIE_DOMAIN=
```

## OpenAuth Server Configuration

The OAuth server needs to be configured with client credentials. Currently, the server at `/Users/brian/github/cheerfulstoic/borderland_oauth` uses OpenAuth's built-in OAuth2 flow.

### Client Registration

OpenAuth may handle client registration automatically, but you need to ensure the client credentials match between the server and this app. Check the OpenAuth documentation for client registration details.

If manual registration is needed, you'll need to:

1. Register this app as a client with the OAuth server
2. Obtain client_id
3. Configure the redirect URI: `https://theborderland.se/api/auth/callback`
4. Set these values in the environment variables above

### OAuth Server Environment Variables

The OAuth server also needs configuration. **Important**: The OAuth server's issuer URL must exactly match the `BORDERLAND_OAUTH_URL` used by this client application.

```bash
# In the borderland_oauth/.env file:
# The OAuth server's public URL - this is used as the issuer claim in JWTs
# Must exactly match BORDERLAND_OAUTH_URL in the client app
OAUTH_URL=https://oauth.theborderland.se  # Production
# OAUTH_URL=http://localhost:3000        # Development

RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=noreply@theborderland.se
DATABASE_URL=postgresql://...
```

## Local Development Setup

### 1. Start the OAuth Server

```bash
cd /Users/brian/github/cheerfulstoic/borderland_oauth
bun run index.ts
# Server runs on http://localhost:3000
```

### 2. Configure This App

In `.env`:

```bash
BORDERLAND_OAUTH_URL=http://localhost:3000
BORDERLAND_OAUTH_CLIENT_ID=your-client-id
OAUTH_REDIRECT_URI=http://localhost:3001/api/auth/callback
SSO_COOKIE_DOMAIN=  # Leave empty for local dev
```

### 3. Start This App

```bash
npm run dev
# App runs on http://localhost:3001 (or your configured port)
```

### 4. Test the Flow

1. Navigate to the app
2. Click "Sign in with Borderland"
3. You'll be redirected to the OAuth server
4. Enter your email
5. Check your email for the verification code
6. Enter the code
7. You'll be redirected back to the app and authenticated

## Production Deployment

### Domain Setup

Ensure these domains are configured:

- `oauth.theborderland.se` - OAuth server
- `theborderland.se` - Main app
- `rea.theborderland.se` - REA app (embedded iframe)

### Environment Variables

Update for production:

```bash
BORDERLAND_OAUTH_URL=https://oauth.theborderland.se
OAUTH_REDIRECT_URI=https://theborderland.se/api/auth/callback
SSO_COOKIE_DOMAIN=.theborderland.se
```

### SSL/HTTPS

- All services must use HTTPS in production
- The SSO cookie requires `secure: true` flag (already configured)
- The cookie uses `sameSite: "none"` to work across subdomains

## Troubleshooting

### "No authorization code received"

- Check that `OAUTH_REDIRECT_URI` matches the redirect URI configured in the OAuth server
- Verify the OAuth server is running and accessible

### "State mismatch" error

- This is a CSRF protection error
- Clear your cookies and try again
- Check that cookies are being set correctly

### SSO not working in REA app

- Verify `SSO_COOKIE_DOMAIN` is set correctly (e.g., `.theborderland.se`)
- Check that the cookie domain matches both apps' domains
- Ensure HTTPS is enabled (required for cross-domain cookies)
- Verify the REA app's `BORDERLAND_OAUTH_URL` points to the same OAuth server

### "Authentication service is not configured properly"

- One or more required environment variables are missing
- Check all `BORDERLAND_OAUTH_*` variables are set

## Files Modified/Created

### New Files

- `app/api/auth/callback/route.ts` - OAuth callback handler
- `app/api/auth/login/route.ts` - OAuth login initiator
- `app/api/auth/logout/route.ts` - Logout handler

### Modified Files

- `app/_components/auth/Auth.tsx` - Replaced Supabase OTP with OAuth redirect
- `app/_components/auth/SignOutButton.tsx` - Updated to use new logout route
- `app/_components/projectswitcher/ProjectSwitcher.tsx` - Updated logout handler
- `app/burn/[slug]/rea/page.tsx` - Added SSO documentation
- `.env.template` - Added OAuth environment variables

### Existing SSO Route

- `app/api/auth/sso/route.ts` - Already exists and is compatible with OpenAuth

## Migration Notes

### What Changed

- **Before**: Supabase OTP (email magic link + 6-digit code)
- **After**: OpenAuth OAuth2 flow with email verification codes

### What Stayed the Same

- User profiles still stored in Supabase
- Session management still uses Supabase
- Authorization/permissions logic unchanged
- Database schema unchanged

### Benefits

- Centralized authentication across multiple apps
- SSO cookie enables seamless cross-app authentication
- More control over authentication UX
- Can easily add more OAuth providers in the future
