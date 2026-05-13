import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { s } from "ajv-ts";
import { BurnRole } from "@/utils/types";

const RemovePurchaseRightRequestSchema = s.object({});

export const POST = requestWithProject<
  s.infer<typeof RemovePurchaseRightRequestSchema>
>(
  async (supabase, profile, request, body, project) => {
    // check if the user has a purchase right to remove
    if (!project!.membership_purchase_right) {
      throw new Error(`User has no membership purchase right to remove`);
    }

    // clear is_being_transferred_to on any membership pointing to this purchase right
    await query(() =>
      supabase
        .from("burn_memberships")
        .update({ is_being_transferred_to: null })
        .eq("is_being_transferred_to", project!.membership_purchase_right!.id),
    );

    // delete the purchase right
    await query(() =>
      supabase
        .from("burn_membership_purchase_rights")
        .delete()
        .eq("id", project!.membership_purchase_right!.id),
    );
  },
  RemovePurchaseRightRequestSchema,
  BurnRole.Participant,
);

