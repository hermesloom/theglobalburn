import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { s } from "ajv-ts";
import { BurnRole } from "@/utils/types";

const UpdateBurnConfigRequestSchema = s.object({
  current_stage: s.string(),
  lottery_opens_at: s.string(),
  lottery_closes_at: s.string(),
  open_sale_lottery_entrants_only_starting_at: s.string(),
  open_sale_general_starting_at: s.string(),
  open_sale_reservation_duration: s.number(),
  transfer_reservation_duration: s.number(),
  plus_one_reservation_duration: s.number(),
  last_possible_transfer_at: s.string(),
  max_memberships: s.number(),
  membership_price_currency: s.string(),
  membership_pricing_type: s.string(),
  membership_price_tier_1: s.number(),
  membership_price_tier_2: s.number(),
  membership_price_tier_3: s.number(),
  share_memberships_lottery: s.number(),
  share_memberships_low_income: s.number(),
  membership_addons: s.array(s.object()),
  stripe_secret_api_key: s.string(),
  stripe_webhook_secret: s.string(),
});

export const PATCH = requestWithProject<
  s.infer<typeof UpdateBurnConfigRequestSchema>
>(
  async (supabase, profile, request, body, project) => {
    const ret = await query(() =>
      supabase
        .from("burn_config")
        .update(body)
        .eq("project_id", project!.id)
        .select()
        .single(),
    );
    return ret;
  },
  UpdateBurnConfigRequestSchema,
  BurnRole.Admin,
);
