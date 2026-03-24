import { SupabaseClient } from "@supabase/supabase-js";
import { query } from "./endpoints";
import {
  Profile,
  Project,
  BurnMembershipPurchaseRight,
  BurnConfig,
  ProjectWithMemberships,
  BurnStage,
  BurnRole,
} from "@/utils/types";

export async function getProjectBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<ProjectWithMemberships> {
  const project = await query(() =>
    supabase
      .from("projects")
      .select("*, burn_memberships(*, profiles(*))")
      .eq("slug", slug)
      .single(),
  );
  return project;
}

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

function normalizeIssueMembershipEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Escape `%`, `_`, and `\` so `ilike` matches the literal address. */
function escapeForExactIlike(email: string): string {
  return email
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

async function findProfileIdByEmailCaseInsensitive(
  supabase: SupabaseClient,
  normalizedEmail: string,
): Promise<string | null> {
  const pattern = escapeForExactIlike(normalizedEmail);
  const rows = await query(() =>
    supabase.from("profiles").select("id").ilike("email", pattern),
  );
  if (rows.length === 0) {
    return null;
  }
  if (rows.length > 1) {
    throw new Error("Multiple profiles match this email");
  }
  return rows[0].id as string;
}

function isAuthUserAlreadyExistsError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("already registered") ||
    m.includes("already been registered") ||
    m.includes("duplicate") ||
    (m.includes("user") && m.includes("already"))
  );
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForProfileIdByEmail(
  supabase: SupabaseClient,
  normalizedEmail: string,
  attempts = 8,
): Promise<string | null> {
  for (let i = 0; i < attempts; i++) {
    const id = await findProfileIdByEmailCaseInsensitive(
      supabase,
      normalizedEmail,
    );
    if (id) {
      return id;
    }
    await sleep(50 * (i + 1));
  }
  return null;
}

async function assignParticipantRoleIfMissing(
  supabase: SupabaseClient,
  userId: string,
  project: Project,
) {
  const participantRole = await query(() =>
    supabase
      .from("roles")
      .select("*")
      .eq("project_id", project.id)
      .eq("name", BurnRole.Participant)
      .single(),
  );

  const existing = await query(() =>
    supabase
      .from("role_assignments")
      .select("id")
      .eq("user_id", userId)
      .eq("role_id", participantRole.id)
      .maybeSingle(),
  );

  if (!existing) {
    await query(() =>
      supabase.from("role_assignments").insert({
        user_id: userId,
        role_id: participantRole.id,
      }),
    );
  }
}

/**
 * Ensures an auth user + profile exist (via admin createUser + DB trigger),
 * and that the user has at least Participant access to the project when they had none.
 */
export async function ensureProfileAndProjectParticipation(
  supabase: SupabaseClient,
  email: string,
  project: Project,
): Promise<Profile> {
  const normalizedEmail = normalizeIssueMembershipEmail(email);
  if (!normalizedEmail) {
    throw new Error("Email is required");
  }

  let userId = await findProfileIdByEmailCaseInsensitive(
    supabase,
    normalizedEmail,
  );

  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
    });

    if (error) {
      if (isAuthUserAlreadyExistsError(error.message)) {
        userId = await waitForProfileIdByEmail(supabase, normalizedEmail);
        if (!userId) {
          throw new Error(
            "A user with this email already exists, but no profile row was found. Check the database.",
          );
        }
      } else {
        throw new Error(error.message);
      }
    } else if (data.user?.id) {
      userId = data.user.id;
      let foundProfile = false;
      for (let i = 0; i < 8; i++) {
        const row = await query(() =>
          supabase.from("profiles").select("id").eq("id", userId).maybeSingle(),
        );
        if (row) {
          foundProfile = true;
          break;
        }
        await sleep(50 * (i + 1));
      }
      if (!foundProfile) {
        throw new Error(
          "Auth user was created but profile row is missing (trigger may have failed).",
        );
      }
    } else {
      throw new Error("Auth user creation returned no user id");
    }
  }

  let profile = await getProfile(supabase, userId);
  if (!profile.projects.some((p) => p.id === project.id)) {
    await assignParticipantRoleIfMissing(supabase, userId, project);
    profile = await getProfile(supabase, userId);
  }

  return profile;
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

export function getTotalLowIncomeAllowed(burnConfig: BurnConfig): number {
  return Math.floor(
    (burnConfig.max_memberships * burnConfig.share_memberships_low_income) /
    100,
  );
}

export async function getAvailableMemberships(
  supabase: SupabaseClient,
  project: Project,
  userId: string,
): Promise<{ availableMemberships: number; lowIncomeAvailable: boolean }> {
  const debug = false;

  if (!userId) {
    throw new Error("user ID must be provided to getAvailableMemberships");
  }

  const memberships = await supabase
    .from("burn_memberships")
    .select("*, is_being_transferred_to(*)", { count: "exact" })
    .eq("project_id", project.id);
  if (debug) {
    console.log(`[DEBUG] number of memberships: ${memberships.count}`);
  }

  // necessary to subtract this later, because otherwise memberships that are in
  // the process of being transferred will be counted twice
  const numMembershipsBeingTransferred = memberships.data!.filter((m) => {
    const transferDest: BurnMembershipPurchaseRight = m.is_being_transferred_to;
    return transferDest && new Date(transferDest.expires_at) > new Date();
  }).length;
  if (debug) {
    console.log(
      `[DEBUG] number of memberships being transferred: ${numMembershipsBeingTransferred}`,
    );
  }

  // Count low income memberships
  const numLowIncomeMemberships = memberships.data!.filter(
    (m) => m.is_low_income,
  ).length;
  if (debug) {
    console.log(
      `[DEBUG] number of low income memberships: ${numLowIncomeMemberships}`,
    );
  }

  // count the number of memberships which are currently being transferred,
  // where both the membership and the transfer destination membership purchase
  // right are low income
  const numLowIncomeMembershipsBeingTransferred = memberships.data!.filter(
    (m) => {
      const transferDest: BurnMembershipPurchaseRight =
        m.is_being_transferred_to;
      return (
        m.is_low_income &&
        transferDest &&
        new Date(transferDest.expires_at) > new Date() &&
        transferDest.is_low_income
      );
    },
  ).length;
  if (debug) {
    console.log(
      `[DEBUG] number of low income memberships being transferred: ${numLowIncomeMembershipsBeingTransferred}`,
    );
  }

  const membershipPurchaseRights = await supabase
    .from("burn_membership_purchase_rights")
    .select("*", { count: "exact" })
    .eq("project_id", project.id)
    .gt("expires_at", new Date().toISOString());
  if (debug) {
    console.log(
      `[DEBUG] number of membership purchase rights: ${membershipPurchaseRights.count}`,
    );
  }

  // Count low income purchase rights
  const numLowIncomePurchaseRights = membershipPurchaseRights.data!.filter(
    (pr) => pr.is_low_income,
  ).length;
  if (debug) {
    console.log(
      `[DEBUG] number of low income purchase rights: ${numLowIncomePurchaseRights}`,
    );
  }

  // Calculate how many low income spots are still available
  if (debug) {
    console.log(`[DEBUG] low income percentage: ${project.burn_config.share_memberships_low_income}`);
  }
  const totalLowIncomeAllowed = getTotalLowIncomeAllowed(project.burn_config);
  if (debug) {
    console.log(`[DEBUG] check that low income percentage was correctly applied: difference due to rounding is ${Math.abs(project.burn_config.share_memberships_low_income / 100 - totalLowIncomeAllowed / project.burn_config.max_memberships) * 100}%-points (should be less than 1, as close to zero as possible)`)
    console.log(`[DEBUG] total low income allowed: ${totalLowIncomeAllowed}`);
  }
  const lowIncomeUsed =
    numLowIncomeMemberships +
    numLowIncomePurchaseRights -
    numLowIncomeMembershipsBeingTransferred;
  if (debug) {
    console.log(`[DEBUG] low income used: ${lowIncomeUsed}`);
  }
  const lowIncomeSpotsAvailable = totalLowIncomeAllowed - lowIncomeUsed;
  if (debug) {
    console.log(
      `[DEBUG] low income spots available: ${lowIncomeSpotsAvailable}`,
    );
  }

  let isUserLowIncomeEligible: boolean;
  if (project.burn_config.current_stage === BurnStage.OpenSaleNonTransferable) {
    isUserLowIncomeEligible = true;
  } else if (
    project.burn_config.current_stage === BurnStage.OpenSaleGeneral &&
    userId
  ) {
    const lowIncomeApplication = await query(() =>
      supabase
        .from("burn_low_income_applications")
        .select("id")
        .eq("project_id", project.id)
        .eq("owner_id", userId)
        .maybeSingle(),
    );
    if (debug) {
      console.log(`[DEBUG] user has entry in burn_low_income_applications: ${!!lowIncomeApplication}`);
    }
    isUserLowIncomeEligible =
      (project.lottery_ticket?.is_low_income ?? false) || !!lowIncomeApplication;
  } else {
    isUserLowIncomeEligible = project.lottery_ticket?.is_low_income ?? false;
  }

  const ret = {
    availableMemberships:
      project?.burn_config.max_memberships! -
      (memberships.count ?? 0) -
      (membershipPurchaseRights.count ?? 0) +
      numMembershipsBeingTransferred,
    lowIncomeAvailable:
      project.burn_config.current_stage === BurnStage.OpenSaleNonTransferable
        ? lowIncomeSpotsAvailable > 0
        : isUserLowIncomeEligible && lowIncomeSpotsAvailable > 0,
  };

  if (debug) {
    console.log(`[DEBUG] ret: ${JSON.stringify(ret)}`);
  }

  return ret;
}
