import { requestWithAPIKey } from "@/app/api/_common/endpoints";

export const GET = requestWithAPIKey(
  async (supabase, req) => {
    const slug = req.nextUrl.pathname.split("/")[3];
    const email = req.nextUrl.searchParams.get("email");
    if (!email) {
      return { isMember: false };
    }
    const normalizedEmail = email.trim().toLowerCase();

    const { data } = await supabase
      .from("burn_memberships")
      .select("id, projects!inner(slug), profiles!inner(email)")
      .eq("projects.slug", slug)
      .ilike("profiles.email", normalizedEmail)
      .limit(1);

    return { isMember: (data?.length ?? 0) > 0 };
  },
  process.env.MEMBERSHIP_CHECK_API_KEY ?? "",
);
