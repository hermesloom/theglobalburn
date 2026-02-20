"use client";

/**
 * REA (Realities Employment Agency) iframe page.
 *
 * The REA app is embedded via iframe and shares authentication through
 * the _borderland_sso cookie. When a user is authenticated in this app,
 * the SSO cookie is set (see app/api/auth/callback/route.ts), and the
 * REA app's SharedSSO plug automatically authenticates the user.
 *
 * No explicit action is needed here - the SSO happens automatically
 * when the REA app loads and detects the shared cookie.
 */
export default function REAPage() {
  return (
    <div className="-m-14 w-[calc(100%+7rem)] h-[calc(100vh)]">
      <iframe
        src="https://rea.theborderland.se"
        className="w-full h-full border-0"
        allow="fullscreen"
        title="Realities Employment Agency"
      />
    </div>
  );
}
