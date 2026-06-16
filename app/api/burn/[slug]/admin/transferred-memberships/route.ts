import { requestWithProject } from "@/app/api/_common/endpoints";
import { BurnRole } from "@/utils/types";

export const GET = requestWithProject(
  async (supabase, profile, request, body, project) => {
    const transfersResult = await supabase
      .from("burn_membership_transfers")
      .select("id, created_at, from_owner_id, to_owner_id, original_membership_json")
      .eq("project_id", project!.id)
      .order("created_at", { ascending: true });

    if (transfersResult.error) {
      console.error("transferred-memberships: transfers query error:", transfersResult.error);
      return { data: [] };
    }

    const transfers = transfersResult.data || [];
    if (transfers.length === 0) {
      return { data: [] };
    }

    const recipientIds = [...new Set(transfers.map((t) => t.to_owner_id).filter(Boolean))];
    if (recipientIds.length === 0) {
      return { data: [] };
    }

    const membershipsResult = await supabase
      .from("burn_memberships")
      .select("id, owner_id, first_name, last_name")
      .eq("project_id", project!.id)
      .in("owner_id", recipientIds);

    if (membershipsResult.error) {
      console.error("transferred-memberships: memberships query error:", membershipsResult.error);
      return { data: [] };
    }

    const memberships = membershipsResult.data || [];

    const allOwnerIds = [
      ...new Set([
        ...memberships.map((m) => m.owner_id),
        ...transfers.map((t) => t.from_owner_id),
        ...transfers.map((t) => t.to_owner_id),
      ].filter(Boolean)),
    ];

    const profilesResult = allOwnerIds.length > 0
      ? await supabase.from("profiles").select("id, email").in("id", allOwnerIds)
      : { data: [], error: null };

    if (profilesResult.error) {
      console.error("transferred-memberships: profiles query error:", profilesResult.error);
    }

    const emailById: Record<string, string> = Object.fromEntries(
      (profilesResult.data || []).map((p) => [p.id, p.email])
    );

    // Map: to_owner_id -> most recent transfer received (array is ascending, so last wins)
    const transfersByRecipient = new Map<string, (typeof transfers)[0]>();
    for (const transfer of transfers) {
      transfersByRecipient.set(transfer.to_owner_id, transfer);
    }

    const buildTransferChain = (ownerId: string, visited = new Set<string>()): object[] => {
      if (visited.has(ownerId)) return [];
      visited.add(ownerId);
      const transfer = transfersByRecipient.get(ownerId);
      if (!transfer) return [];
      const prior = buildTransferChain(transfer.from_owner_id, visited);
      return [
        ...prior,
        {
          created_at: transfer.created_at,
          from_owner_id: transfer.from_owner_id,
          from_first_name: (transfer.original_membership_json as any)?.first_name,
          from_last_name: (transfer.original_membership_json as any)?.last_name,
          from_email: emailById[transfer.from_owner_id],
          to_owner_id: transfer.to_owner_id,
          to_email: emailById[transfer.to_owner_id],
        },
      ];
    };

    return {
      data: memberships.map((m) => ({
        id: m.id,
        first_name: m.first_name,
        last_name: m.last_name,
        email: emailById[m.owner_id] ?? "",
        transfer_history: buildTransferChain(m.owner_id),
      })),
    };
  },
  undefined,
  [BurnRole.MembershipManager, BurnRole.MembershipLead]
);
