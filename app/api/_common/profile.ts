import { SupabaseClient } from "@supabase/supabase-js";
import { query } from "./endpoints";
import { Profile, Project, BurnMembershipPurchaseRight } from "@/utils/types";

export async function getProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<Profile> {
  const profile = await query(() =>
    supabase
      .from("profiles")
      .select(
        "*, role_assignments(roles(name, project_id)), burn_lottery_tickets(*), burn_membership_purchase_rights(*), burn_memberships(*)",
      )
      .eq("id", userId)
      .single(),
  );

  const projectIds = profile.role_assignments.map(
    (ra: any) => ra.roles.project_id,
  );
  const projects = await query(() =>
    supabase.from("projects").select("*, burn_config(*)").in("id", projectIds),
  );

  for (const p of projects) {
    p.roles = profile.role_assignments
      .filter((ra: any) => ra.roles.project_id === p.id)
      .map((ra: any) => ra.roles.name);
    p.burn_config = p.burn_config[0];
  }
  delete profile.role_assignments;

  for (const lt of profile.burn_lottery_tickets) {
    const project = projects.find((p: any) => p.id === lt.project_id);
    project.lottery_ticket = lt;
  }
  delete profile.burn_lottery_tickets;

  for (const bmp of profile.burn_membership_purchase_rights) {
    if (new Date(bmp.expires_at) < new Date()) {
      continue;
    }

    const project: Project = projects.find((p: any) => p.id === bmp.project_id);
    project.membership_purchase_right = bmp;
  }
  delete profile.burn_membership_purchase_rights;

  for (const bm of profile.burn_memberships) {
    const project: Project = projects.find((p: any) => p.id === bm.project_id);

    // If membership is being transferred, check if the transfer is still valid
    if (bm.is_being_transferred_to) {
      // We need to check if the purchase right still exists and hasn't expired
      const purchaseRightResult = await query(() =>
        supabase
          .from("burn_membership_purchase_rights")
          .select("*")
          .eq("id", bm.is_being_transferred_to)
          .single(),
      );

      // If purchase right doesn't exist or has expired, clear the transfer flag
      if (
        !purchaseRightResult ||
        new Date(purchaseRightResult.expires_at) < new Date()
      ) {
        bm.is_being_transferred_to = undefined;
      }
    }

    project.membership = bm;
  }
  delete profile.burn_memberships;

  return { ...profile, projects };
}

export async function getProfileByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<Profile> {
  const profile = await query(() =>
    supabase.from("profiles").select("*").eq("email", email),
  );

  if (profile.length === 0) {
    throw new Error("No profile found for " + email);
  }

  return getProfile(supabase, profile[0].id);
}

// make sure that the given profile:
// - is part of the given project
// - does not have a membership or a membership purchase right for this project already
export function validateNewMembershipEligibility(
  profile: Profile,
  destProject: Project,
) {
  const recipientProject = profile.projects.find(
    (p) => p.id === destProject.id,
  );

  if (!recipientProject) {
    throw new Error(`Recipient needs to join "${destProject.name}" first`);
  }

  if (recipientProject.membership_purchase_right) {
    throw new Error(
      "Recipient already has an available membership to purchase",
    );
  }

  if (recipientProject.membership) {
    throw new Error("Recipient already has a membership");
  }

  return recipientProject;
}

export async function checkNoSuchMembershipOrPurchaseRightExists(
  supabase: SupabaseClient,
  projectId: string,
  firstName: string,
  lastName: string,
  birthdate: string,
) {
  const existingMembershipPurchaseRight = await query(() =>
    supabase
      .from("burn_membership_purchase_rights")
      .select("*")
      .eq("project_id", projectId)
      .eq("first_name", firstName)
      .eq("last_name", lastName)
      .eq("birthdate", birthdate)
      .gt("expires_at", new Date().toISOString()),
  );
  if (existingMembershipPurchaseRight.length > 0) {
    throw new Error(
      "This individual already has an active membership purchase right",
    );
  }

  const existingMembership = await query(() =>
    supabase
      .from("burn_memberships")
      .select("*")
      .eq("project_id", projectId)
      .eq("first_name", firstName)
      .eq("last_name", lastName)
      .eq("birthdate", birthdate),
  );
  if (existingMembership.length > 0) {
    throw new Error("This individual already has a membership");
  }
}

export async function getAvailableMemberships(
  supabase: SupabaseClient,
  project: Project,
): Promise<number> {
  const numMemberships = await supabase
    .from("burn_memberships")
    .select("*, is_being_transferred_to(*)", { count: "exact" })
    .eq("project_id", project.id);

  const numMembershipsBeingTransferred = numMemberships.data!.filter((m) => {
    const transferDest: BurnMembershipPurchaseRight = m.is_being_transferred_to;
    return transferDest && new Date(transferDest.expires_at) > new Date();
  }).length;

  const numMembershipPurchaseRights = await supabase
    .from("burn_membership_purchase_rights")
    .select("*", { count: "exact" })
    .eq("project_id", project.id)
    .gt("expires_at", new Date().toISOString());

  return (
    project?.burn_config.max_memberships! -
    (numMemberships.count ?? 0) -
    (numMembershipPurchaseRights.count ?? 0) +
    numMembershipsBeingTransferred
  );
}
