import { s } from "ajv-ts";
import { requestWithAuthAdmin, query } from "@/app/api/_common/endpoints";
import { BurnStage, BurnRole } from "@/utils/types";

export const GET = requestWithAuthAdmin(async (supabase) => {
  return { data: await query(() => supabase.from("projects").select("*")) };
});

const CreateProjectRequestSchema = s.object({
  name: s.string(),
  type: s.string(),
  slug: s.string(),
});

export const POST = requestWithAuthAdmin<
  s.infer<typeof CreateProjectRequestSchema>
>(async (supabase, profile, request, body) => {
  const { name, type, slug } = body;

  const project = await query(() =>
    supabase.from("projects").insert({ name, type, slug }).select().single()
  );

  await query(() =>
    supabase.from("burn_config").insert({
      project_id: project.id,
      current_stage: BurnStage.LotteryOpen,
      open_sale_lottery_entrants_only_starting_at: new Date(
        new Date().getTime() + 1000 * 60 * 60 * 24
      ).toISOString(),
      open_sale_general_starting_at: new Date(
        new Date().getTime() + 1000 * 60 * 60 * 24 * 2
      ).toISOString(),
      open_sale_reservation_duration: 60 * 30, // 30 minutes
      transfer_reservation_duration: 60 * 60 * 24 * 7, // 7 days
      plus_one_reservation_duration: 60 * 60 * 72, // 72 hours
      last_possible_transfer_at: new Date(
        new Date().getTime() + 1000 * 60 * 60 * 24 * 7
      ).toISOString(),
      max_memberships: 4603,
      membership_price_currency: "SEK",
      membership_pricing_type: "tiered-3",
      membership_price_tier_1: 1180,
      membership_price_tier_2: 2020,
      membership_price_tier_3: 2800,
      share_memberships_lottery: 50,
      share_memberships_low_income: 10,
      membership_addons: [
        {
          id: "alversjo-membership",
          name: "Alversjö membership",
          link: "https://opencollective.com/alversjo",
          price: 600,
        },
      ],
    })
  );

  const initialRoles = [
    BurnRole.Admin,
    BurnRole.Participant,
    BurnRole.MembershipManager,
    BurnRole.MembershipScanner,
  ];

  for (const role of initialRoles) {
    const newRole = await query(() =>
      supabase
        .from("roles")
        .insert({
          project_id: project.id,
          name: role,
        })
        .select()
        .single()
    );

    await query(() =>
      supabase.from("role_assignments").insert({
        user_id: profile.id,
        role_id: newRole.id,
      })
    );
  }
}, CreateProjectRequestSchema);
