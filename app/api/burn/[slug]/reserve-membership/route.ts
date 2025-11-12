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

    await supabase.from("burn_membership_purchase_rights").insert({
      project_id: project!.id,
      owner_id: profile!.id,
      expires_at: new Date(
        new Date().getTime() +
          project?.burn_config.open_sale_reservation_duration! * 1000,
      ).toISOString(),
      is_low_income: lowIncomeAvailable,
      details_modifiable: true,
      is_non_transferable:
        project?.burn_config.current_stage ===
        BurnStage.OpenSaleNonTransferable,
    });
  },
  undefined,
  BurnRole.Participant,
);
