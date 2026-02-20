import type { NextResponse } from "next/server";

export const SSO_COOKIE_NAME = "_borderland_sso";

type ResponseWithCookies = Pick<NextResponse, "cookies">;

/**
 * Set the SSO token cookie with environment-appropriate settings.
 *
 * Production (SSO_COOKIE_DOMAIN set): cross-subdomain cookie (secure, sameSite=none)
 * Development (no domain): localhost cookie (not secure, sameSite=lax)
 */
export function setTokenCookie(
  response: ResponseWithCookies,
  value: string
) {
  const domain = process.env.SSO_COOKIE_DOMAIN;
  const maxAge = 60 * 60 * 24 * 7; // 7 days
  if (domain) {
    response.cookies.set(SSO_COOKIE_NAME, value, {
      domain,
      secure: true,
      httpOnly: true,
      sameSite: "none",
      path: "/",
      maxAge,
    });
  } else {
    response.cookies.set(SSO_COOKIE_NAME, value, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge,
    });
  }
}

/**
 * Clear the SSO token cookie with environment-appropriate settings.
 */
export function clearTokenCookie(response: ResponseWithCookies) {
  const domain = process.env.SSO_COOKIE_DOMAIN;
  if (domain) {
    response.cookies.set(SSO_COOKIE_NAME, "", {
      domain,
      secure: true,
      httpOnly: true,
      sameSite: "none",
      path: "/",
      maxAge: 0,
    });
  } else {
    response.cookies.set(SSO_COOKIE_NAME, "", {
      secure: false,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
}
