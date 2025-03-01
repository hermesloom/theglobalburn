import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { BurnRole, BurnStage } from "@/utils/types";

export const POST = requestWithProject(
  async (supabase, profile, request, body, project) => {
    if (
      project!.burn_config.current_stage !==
      BurnStage.OpenSaleLotteryEntrantsOnly
    ) {
      throw new Error(
        `Burn stage must be ${BurnStage.OpenSaleLotteryEntrantsOnly}`,
      );
    }

    await query(() =>
      supabase
        .from("burn_config")
        .update({ current_stage: BurnStage.OpenSaleGeneral })
        .eq("id", project!.burn_config.id!),
    );
  },
  undefined,
  BurnRole.MembershipManager,
);
