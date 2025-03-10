import { requestWithAPIKeyAndProject } from "@/app/api/_common/endpoints";

export const GET = requestWithAPIKeyAndProject(
  async (supabase, req, body, project) => {
    return project?.burn_memberships.map((m) => m.profiles.email);
  },
  process.env.COBUDGET_API_KEY ?? "",
);
