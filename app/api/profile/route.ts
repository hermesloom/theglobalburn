import { requestWithAuth } from "@/app/api/_common/endpoints";

export const GET = requestWithAuth(async (supabase, profile) => {
  return profile;
});
