import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { BurnRole } from "@/utils/types";

export const GET = requestWithProject(
  async (supabase, profile, request, body, project) => {
    const transfers: any[] = await query(() =>
      supabase
        .from("burn_membership_transfers")
        .select("id, created_at, from_owner_id, to_owner_id, original_membership_json")
        .eq("project_id", project!.id)
        .order("created_at", { ascending: true })
    );

    if (transfers.length === 0) {
      return { data: [] };
    }

    const recipientIds = [...new Set(transfers.map((t) => t.to_owner_id))];

    const memberships = await query(() =>
      supabase
        .from("burn_memberships")
        .select("id, owner_id, first_name, last_name")
        .eq("project_id", project!.id)
        .in("owner_id", recipientIds)
    );

    const profileIds = [
      ...new Set([
        ...(memberships as any[]).map((m) => m.owner_id),
        ...transfers.map((t) => t.from_owner_id),
        ...transfers.map((t) => t.to_owner_id),
      ]),
    ];

    const profiles = await query(() =>
      supabase.from("profiles").select("id, email").in("id", profileIds)
    );

    const emailById: Record<string, string> = Object.fromEntries(
      (profiles as any[]).map((p) => [p.id, p.email])
    );

    // Map: to_owner_id -> all transfers received (ordered asc, so last is most recent)
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
      data: (memberships as any[]).map((m) => ({
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
