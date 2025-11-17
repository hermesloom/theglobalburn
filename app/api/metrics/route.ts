import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { query } from "@/app/api/_common/endpoints";
import { getProjectBySlug } from "@/app/api/_common/profile";

const PROJECT_SLUG = "the-borderland-2026";

/**
 * Prometheus metrics endpoint
 * Exposes platform metrics in Prometheus text format
 * All statistics are filtered to only include data for the-borderland-2026 project
 * Protected by Bearer token authentication using GRAFANA_API_KEY
 */
export async function GET(req: NextRequest) {
  // Check Bearer token authentication
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const grafanaApiKey = process.env.GRAFANA_API_KEY;
  if (!grafanaApiKey) {
    console.error("GRAFANA_API_KEY environment variable is not set");
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }

  if (token !== grafanaApiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  try {
    // Get the project
    const project = await getProjectBySlug(supabase, PROJECT_SLUG);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const projectId = project.id;
    const metrics: string[] = [];
    const now = new Date();

    // ===== USER STATISTICS =====
    // Get users with role assignments (participants)
    const roles = await query(() =>
      supabase.from("roles").select("id").eq("project_id", projectId),
    );
    const roleIds = roles?.map((r: any) => r.id) || [];
    const roleAssignments = roleIds.length
      ? await query(() =>
          supabase
            .from("role_assignments")
            .select("user_id")
            .in("role_id", roleIds),
        )
      : [];
    const uniqueUserIds = new Set(
      roleAssignments?.map((ra: any) => ra.user_id) || [],
    );
    const totalParticipants = uniqueUserIds.size;

    // Get users with memberships
    const memberships = await query(() =>
      supabase
        .from("burn_memberships")
        .select(
          "owner_id, is_low_income, checked_in_at, is_being_transferred_to",
        )
        .eq("project_id", projectId),
    );
    const usersWithMemberships = new Set(
      memberships?.map((m: any) => m.owner_id) || [],
    );

    metrics.push(
      `# HELP platform_participants_total Total participants (users with role assignments)`,
    );
    metrics.push(`# TYPE platform_participants_total gauge`);
    metrics.push(`platform_participants_total ${totalParticipants}`);

    metrics.push(
      `# HELP platform_users_with_memberships Total users who have memberships`,
    );
    metrics.push(`# TYPE platform_users_with_memberships gauge`);
    metrics.push(
      `platform_users_with_memberships ${usersWithMemberships.size}`,
    );

    // ===== MEMBERSHIP STATISTICS =====
    const totalMemberships = memberships?.length || 0;
    const activeMemberships =
      memberships?.filter((m: any) => !m.is_being_transferred_to).length || 0;
    const membershipsBeingTransferred =
      memberships?.filter((m: any) => m.is_being_transferred_to).length || 0;
    const checkedInMemberships =
      memberships?.filter((m: any) => m.checked_in_at).length || 0;
    const lowIncomeMemberships =
      memberships?.filter((m: any) => m.is_low_income).length || 0;
    const regularMemberships = totalMemberships - lowIncomeMemberships;

    metrics.push(
      `# HELP platform_memberships_total Total number of memberships`,
    );
    metrics.push(`# TYPE platform_memberships_total gauge`);
    metrics.push(`platform_memberships_total ${totalMemberships}`);

    metrics.push(
      `# HELP platform_memberships_active Active memberships (not being transferred)`,
    );
    metrics.push(`# TYPE platform_memberships_active gauge`);
    metrics.push(`platform_memberships_active ${activeMemberships}`);

    metrics.push(
      `# HELP platform_memberships_being_transferred Memberships currently being transferred`,
    );
    metrics.push(`# TYPE platform_memberships_being_transferred gauge`);
    metrics.push(
      `platform_memberships_being_transferred ${membershipsBeingTransferred}`,
    );

    metrics.push(
      `# HELP platform_memberships_checked_in Memberships that have been checked in`,
    );
    metrics.push(`# TYPE platform_memberships_checked_in gauge`);
    metrics.push(`platform_memberships_checked_in ${checkedInMemberships}`);

    metrics.push(
      `# HELP platform_memberships_by_type Number of memberships by type`,
    );
    metrics.push(`# TYPE platform_memberships_by_type gauge`);
    metrics.push(
      `platform_memberships_by_type{type="low_income"} ${lowIncomeMemberships}`,
    );
    metrics.push(
      `platform_memberships_by_type{type="regular"} ${regularMemberships}`,
    );

    // ===== PURCHASE RIGHTS STATISTICS =====
    const purchaseRights = await query(() =>
      supabase
        .from("burn_membership_purchase_rights")
        .select("project_id, is_low_income, expires_at")
        .eq("project_id", projectId),
    );
    const totalPurchaseRights = purchaseRights?.length || 0;
    const activePurchaseRights =
      purchaseRights?.filter((pr: any) => new Date(pr.expires_at) > now)
        .length || 0;
    const expiredPurchaseRights = totalPurchaseRights - activePurchaseRights;
    const lowIncomePurchaseRights =
      purchaseRights?.filter((pr: any) => pr.is_low_income).length || 0;
    const regularPurchaseRights = totalPurchaseRights - lowIncomePurchaseRights;

    metrics.push(
      `# HELP platform_purchase_rights_total Total number of purchase rights`,
    );
    metrics.push(`# TYPE platform_purchase_rights_total gauge`);
    metrics.push(`platform_purchase_rights_total ${totalPurchaseRights}`);

    metrics.push(
      `# HELP platform_purchase_rights_active Active purchase rights (not expired)`,
    );
    metrics.push(`# TYPE platform_purchase_rights_active gauge`);
    metrics.push(`platform_purchase_rights_active ${activePurchaseRights}`);

    metrics.push(
      `# HELP platform_purchase_rights_expired Expired purchase rights`,
    );
    metrics.push(`# TYPE platform_purchase_rights_expired gauge`);
    metrics.push(`platform_purchase_rights_expired ${expiredPurchaseRights}`);

    metrics.push(
      `# HELP platform_purchase_rights_by_type Purchase rights by type`,
    );
    metrics.push(`# TYPE platform_purchase_rights_by_type gauge`);
    metrics.push(
      `platform_purchase_rights_by_type{type="low_income"} ${lowIncomePurchaseRights}`,
    );
    metrics.push(
      `platform_purchase_rights_by_type{type="regular"} ${regularPurchaseRights}`,
    );

    // ===== REQUEST STATISTICS (last 24 hours) =====
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentLogs = await query(() =>
      supabase
        .from("request_logs")
        .select("method, status_code, response_time_ms, country, path")
        .gte("created_at", oneDayAgo)
        .like("path", `%/burn/${PROJECT_SLUG}/%`),
    );

    const methodCounts = new Map<string, number>();
    const statusCounts = new Map<number, number>();
    const errorCounts = { client: 0, server: 0 };
    const responseTimes: number[] = [];
    const countryCounts = new Map<string, number>();

    recentLogs?.forEach((log: any) => {
      const method = log.method || "UNKNOWN";
      methodCounts.set(method, (methodCounts.get(method) || 0) + 1);

      const status = log.status_code || 0;
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);

      // Track error rates
      if (status >= 400 && status < 500) {
        errorCounts.client++;
      } else if (status >= 500) {
        errorCounts.server++;
      }

      if (log.response_time_ms) {
        responseTimes.push(log.response_time_ms);
      }

      if (log.country) {
        countryCounts.set(
          log.country,
          (countryCounts.get(log.country) || 0) + 1,
        );
      }
    });

    const totalRequests = recentLogs?.length || 0;

    metrics.push(`# HELP platform_requests_total Total requests in last 24h`);
    metrics.push(`# TYPE platform_requests_total gauge`);
    metrics.push(`platform_requests_total ${totalRequests}`);

    metrics.push(
      `# HELP platform_requests_by_method Requests by HTTP method (last 24h)`,
    );
    metrics.push(`# TYPE platform_requests_by_method gauge`);
    for (const [method, count] of methodCounts.entries()) {
      metrics.push(`platform_requests_by_method{method="${method}"} ${count}`);
    }

    metrics.push(
      `# HELP platform_requests_by_status Requests by HTTP status code (last 24h)`,
    );
    metrics.push(`# TYPE platform_requests_by_status gauge`);
    for (const [status, count] of statusCounts.entries()) {
      metrics.push(`platform_requests_by_status{status="${status}"} ${count}`);
    }

    metrics.push(
      `# HELP platform_requests_errors_client Client errors (4xx) in last 24h`,
    );
    metrics.push(`# TYPE platform_requests_errors_client gauge`);
    metrics.push(`platform_requests_errors_client ${errorCounts.client}`);

    metrics.push(
      `# HELP platform_requests_errors_server Server errors (5xx) in last 24h`,
    );
    metrics.push(`# TYPE platform_requests_errors_server gauge`);
    metrics.push(`platform_requests_errors_server ${errorCounts.server}`);

    // Response time statistics
    if (responseTimes.length > 0) {
      const sorted = responseTimes.sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];
      const sum = responseTimes.reduce((a, b) => a + b, 0);

      metrics.push(
        `# HELP platform_response_time_ms Response time statistics (last 24h)`,
      );
      metrics.push(`# TYPE platform_response_time_ms summary`);
      metrics.push(
        `platform_response_time_ms{quantile="0.5"} ${p50.toFixed(2)}`,
      );
      metrics.push(
        `platform_response_time_ms{quantile="0.95"} ${p95.toFixed(2)}`,
      );
      metrics.push(
        `platform_response_time_ms{quantile="0.99"} ${p99.toFixed(2)}`,
      );
      metrics.push(`platform_response_time_ms_sum ${sum}`);
      metrics.push(`platform_response_time_ms_count ${responseTimes.length}`);
    }

    // Top countries by request count
    metrics.push(
      `# HELP platform_requests_by_country Requests by country (last 24h, top 10)`,
    );
    metrics.push(`# TYPE platform_requests_by_country gauge`);
    const topCountries = Array.from(countryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    for (const [country, count] of topCountries) {
      metrics.push(
        `platform_requests_by_country{country="${country}"} ${count}`,
      );
    }

    // ===== CONTENT STATISTICS =====
    // Welcome messages
    const { count: welcomesCount } = await supabase
      .from("burn_welcome")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId);
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { count: recentWelcomesCount } = await supabase
      .from("burn_welcome")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId)
      .gte("created_at", sevenDaysAgo);

    metrics.push(`# HELP platform_welcomes_total Total welcome messages`);
    metrics.push(`# TYPE platform_welcomes_total gauge`);
    metrics.push(`platform_welcomes_total ${welcomesCount || 0}`);

    metrics.push(
      `# HELP platform_welcomes_recent Welcome messages created in last 7 days`,
    );
    metrics.push(`# TYPE platform_welcomes_recent gauge`);
    metrics.push(`platform_welcomes_recent ${recentWelcomesCount || 0}`);

    // Ideas
    const ideas = await query(() =>
      supabase
        .from("burn_ideas")
        .select("id, created_at")
        .eq("project_id", projectId),
    );
    const ideasCount = ideas?.length || 0;
    const recentIdeasCount =
      ideas?.filter(
        (i: any) => new Date(i.created_at) >= new Date(sevenDaysAgo),
      ).length || 0;

    // Get ideas with votes
    const ideaIds = ideas?.map((i: any) => i.id) || [];
    const ideaVotes = ideaIds.length
      ? await query(() =>
          supabase
            .from("burn_idea_votes")
            .select("idea_id")
            .in("idea_id", ideaIds),
        )
      : [];
    const ideasWithVotes = new Set(ideaVotes?.map((v: any) => v.idea_id) || [])
      .size;

    metrics.push(`# HELP platform_ideas_total Total ideas`);
    metrics.push(`# TYPE platform_ideas_total gauge`);
    metrics.push(`platform_ideas_total ${ideasCount}`);

    metrics.push(`# HELP platform_ideas_recent Ideas created in last 7 days`);
    metrics.push(`# TYPE platform_ideas_recent gauge`);
    metrics.push(`platform_ideas_recent ${recentIdeasCount}`);

    metrics.push(
      `# HELP platform_ideas_with_votes Ideas that have received at least one vote`,
    );
    metrics.push(`# TYPE platform_ideas_with_votes gauge`);
    metrics.push(`platform_ideas_with_votes ${ideasWithVotes}`);

    // Links
    const { count: linksCount } = await supabase
      .from("burn_links")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId);
    const { count: recentLinksCount } = await supabase
      .from("burn_links")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId)
      .gte("created_at", sevenDaysAgo);

    metrics.push(`# HELP platform_links_total Total links`);
    metrics.push(`# TYPE platform_links_total gauge`);
    metrics.push(`platform_links_total ${linksCount || 0}`);

    metrics.push(`# HELP platform_links_recent Links created in last 7 days`);
    metrics.push(`# TYPE platform_links_recent gauge`);
    metrics.push(`platform_links_recent ${recentLinksCount || 0}`);

    return new NextResponse(metrics.join("\n") + "\n", {
      headers: {
        "Content-Type": "text/plain; version=0.0.4",
      },
    });
  } catch (error: any) {
    console.error("Error generating metrics:", error);
    return NextResponse.json(
      { error: "Failed to generate metrics" },
      { status: 500 },
    );
  }
}
