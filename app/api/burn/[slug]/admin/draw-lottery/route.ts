import { requestWithProject, query } from "@/app/api/_common/endpoints";
import {
  BurnLotteryTicket,
  BurnRole,
  BurnConfig,
  BurnMembershipPurchaseRight,
} from "@/utils/types";
import { getTotalLowIncomeAllowed } from "@/app/api/_common/profile";

function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// draw lottery winners
export const POST = requestWithProject(
  async (supabase, profile, request, body, project) => {
    const burnConfig: BurnConfig = await query(() =>
      supabase
        .from("burn_config")
        .select("*")
        .eq("project_id", project!.id)
        .single(),
    );

    const allLotteryTicketsShuffled: BurnLotteryTicket[] = shuffleArray(
      await query(() =>
        supabase
          .from("burn_lottery_tickets")
          .select("*")
          .eq("project_id", project!.id),
      ),
    );
    console.log(
      `[LOTTERY] All ${allLotteryTicketsShuffled.length} lottery tickets shuffled`,
    );

    if (allLotteryTicketsShuffled.some((lt) => lt.is_winner)) {
      throw new Error("Lottery winners already drawn");
    }

    // determine how many lottery winners there are in total
    const numLotteryWinners = Math.floor(
      (burnConfig.max_memberships * burnConfig.share_memberships_lottery) / 100,
    );
    console.log(`[LOTTERY] Number of lottery winners: ${numLotteryWinners}`);

    // determine how many low income winners there are
    const numReservedForLowIncome = getTotalLowIncomeAllowed(burnConfig);
    console.log(
      `[LOTTERY] Number of low income winners: ${numReservedForLowIncome}`,
    );

    // draw the low income winners
    const lowIncomeWinnerIds = allLotteryTicketsShuffled
      .filter((ticket) => ticket.is_low_income)
      .slice(0, numReservedForLowIncome)
      .map((ticket) => ticket.id);
    console.log(
      `[LOTTERY] Drawn ${lowIncomeWinnerIds.length} low income winners`,
    );

    // from everyone who is not a low income winner, draw the rest of the lottery winners
    const otherWinnerIds =
      numLotteryWinners - lowIncomeWinnerIds.length > 0
        ? allLotteryTicketsShuffled
            .filter((ticket) => !lowIncomeWinnerIds.includes(ticket.id))
            .slice(0, numLotteryWinners - lowIncomeWinnerIds.length)
            .map((ticket) => ticket.id)
        : [];
    console.log(
      `[LOTTERY] Drawn ${otherWinnerIds.length} regular-/high-income winners`,
    );

    // update the database with the winners in chunks of 200
    const winnerIds = [...lowIncomeWinnerIds, ...otherWinnerIds];
    console.log(`[LOTTERY] Updating database with ${winnerIds.length} winners`);
    for (const chunk of chunkArray(winnerIds, 200)) {
      await query(() =>
        supabase
          .from("burn_lottery_tickets")
          .update({ is_winner: true, can_invite_plus_one: true })
          .in("id", chunk),
      );
    }

    // fetch winning lottery tickets in chunks of 200
    const winningLotteryTickets: BurnLotteryTicket[] = [];
    for (const chunk of chunkArray(winnerIds, 200)) {
      const tickets = await query(() =>
        supabase.from("burn_lottery_tickets").select("*").in("id", chunk),
      );
      winningLotteryTickets.push(...tickets);
    }
    console.log(
      `[LOTTERY] Fetched ${winningLotteryTickets.length} winning lottery tickets`,
    );

    const membershipPurchaseRights: Partial<BurnMembershipPurchaseRight>[] =
      winningLotteryTickets.map((ticket) => ({
        project_id: project!.id,
        owner_id: (ticket as any).owner_id,
        expires_at: new Date(
          +new Date() +
            project?.burn_config.plus_one_reservation_duration! * 1000,
        ).toISOString(),
        first_name: ticket.first_name,
        last_name: ticket.last_name,
        birthdate: ticket.birthdate,
        is_low_income: lowIncomeWinnerIds.includes(ticket.id)
          ? ticket.is_low_income
          : false,
        details_modifiable: false,
      }));

    // insert the membership purchase rights in chunks of 200
    for (const chunk of chunkArray(membershipPurchaseRights, 200)) {
      await query(() =>
        supabase.from("burn_membership_purchase_rights").insert(chunk),
      );
    }

    console.log(
      `[LOTTERY] Inserted ${membershipPurchaseRights.length} membership purchase rights`,
    );

    return {
      numDrawn: lowIncomeWinnerIds.length + otherWinnerIds.length,
    };
  },
  undefined,
  BurnRole.MembershipManager,
);
