import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { BurnRole, BurnStage } from "@/utils/types";
import { getAvailableMemberships } from "@/app/api/_common/profile";

export const POST = requestWithProject(
  async (supabase, profile, request, body, project) => {
    const { availableMemberships, lowIncomeAvailable } =
      await getAvailableMemberships(supabase, project!);

    if (availableMemberships === 0) {
      throw new Error("No more memberships available");
    }

    if (
      project?.burn_config.current_stage ===
        BurnStage.OpenSaleLotteryEntrantsOnly &&
      !project?.lottery_ticket
    ) {
      throw new Error(
        `As you don't have a lottery ticket, you must wait until the burn stage is ${BurnStage.OpenSaleGeneral}`,
      );
    }

    // Check date range for open-sale-non-transferable
    let isLowIncome = lowIncomeAvailable;
    if (
      project?.burn_config.current_stage === BurnStage.OpenSaleNonTransferable
    ) {
      const now = new Date();
      const startingAt =
        project.burn_config.open_sale_non_transferable_starting_at;
      const endingAt = project.burn_config.open_sale_non_transferable_ending_at;

      if (!startingAt || !endingAt) {
        throw new Error(
          "The sale dates are not configured. Please contact support.",
        );
      }

      const startDate = new Date(startingAt);
      const endDate = new Date(endingAt);

      if (now < startDate || now > endDate) {
        throw new Error(
          "The Fall Membership Sale is not currently open. Please check the sale dates.",
        );
      }

      // Check if user had a low-income membership for the-borderland-2025
      const previousProject = await query(() =>
        supabase
          .from("projects")
          .select("id")
          .eq("slug", "the-borderland-2025")
          .single(),
      );

      if (previousProject) {
        const previousMembership = await query(() =>
          supabase
            .from("burn_memberships")
            .select("is_low_income")
            .eq("project_id", previousProject.id)
            .eq("owner_id", profile.id)
            .eq("is_low_income", true)
            .maybeSingle(),
        );

        isLowIncome = !!previousMembership;
      } else {
        isLowIncome = false;
      }
    }

    await supabase.from("burn_membership_purchase_rights").insert({
      project_id: project!.id,
      owner_id: profile!.id,
      expires_at: new Date(
        new Date().getTime() +
          project?.burn_config.open_sale_reservation_duration! * 1000,
      ).toISOString(),
      is_low_income: isLowIncome,
      details_modifiable: true,
      is_non_transferable:
        project?.burn_config.current_stage ===
        BurnStage.OpenSaleNonTransferable,
    });
  },
  undefined,
  BurnRole.Participant,
);
