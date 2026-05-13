import { requestWithMembership, query } from "@/app/api/_common/endpoints";

export const GET = requestWithMembership(
  async (supabase, profile, request, body, project) => {

    // Get all memberships for this project
    const memberships = await query(() =>
      supabase
        .from("burn_memberships")
        .select("price, is_low_income, metadata")
        .eq("project_id", project!.id)
    );

    // Get burn config to determine price tiers
    const burnConfig = project!.burn_config;
    const tier1Price = burnConfig.membership_price_tier_1;
    const tier2Price = burnConfig.membership_price_tier_2;
    const tier3Price = burnConfig.membership_price_tier_3;

    // Count memberships by income tier
    let lowIncome = 0;
    let mediumIncome = 0;
    let highIncome = 0;
    let alversjo = 0;

    for (const membership of memberships) {
      // Calculate base price (price minus addons)
      const enabledAddons = membership.metadata?.enabled_addons ?? [];
      const addonPrices = enabledAddons.reduce((acc: number, addonId: string) => {
        const addon = burnConfig.membership_addons.find((a) => a.id === addonId);
        return acc + (addon?.price ?? 0);
      }, 0);
      const basePrice = membership.price - addonPrices;

      // Determine income tier based on base price
      if (basePrice === tier1Price || membership.is_low_income) {
        lowIncome++;
      } else if (basePrice === tier2Price) {
        mediumIncome++;
      } else if (basePrice === tier3Price) {
        highIncome++;
      }

      // Check if Alversjö addon is enabled
      if (enabledAddons.includes("alversjo-membership")) {
        alversjo++;
      }
    }

    return {
      lowIncome,
      mediumIncome,
      highIncome,
      alversjo,
      total: memberships.length,
    };
  }
);

