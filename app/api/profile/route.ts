import { requestWithAuth } from "@/app/api/_common/endpoints";

export const GET = requestWithAuth(async (supabase, profile) => {
  if (!profile.is_admin) {
    for (const p of profile.projects) {
      delete (p.burn_config as any).stripe_secret_api_key;
      delete (p.burn_config as any).stripe_webhook_secret;
    }
  }

  return profile;
});
