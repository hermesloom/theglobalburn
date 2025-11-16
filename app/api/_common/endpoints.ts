import { s } from "ajv-ts";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { SupabaseClient } from "@supabase/supabase-js";
import {
  Profile,
  Project,
  ProjectWithMemberships,
  BurnRole,
} from "@/utils/types";
import { getProfile, getProjectBySlug } from "./profile";
import { getLocationFromIP } from "./geolocation";

export type RequestWithAuthHandler<T = any> = (
  supabase: SupabaseClient,
  profile: Profile,
  request: NextRequest,
  body: T,
  project?: Project,
) => Promise<any> | Promise<NextResponse>;

export type RequestWithAPIKeyHandler<T = any> = (
  supabase: SupabaseClient,
  request: NextRequest,
  body: T,
  project?: ProjectWithMemberships,
) => Promise<any> | Promise<NextResponse>;

export function requestWithAPIKey<T = any>(
  handler: RequestWithAPIKeyHandler<T>,
  key: string,
  schema?: s.Object,
) {
  return async (req: NextRequest) => {
    const startTime = Date.now();
    const supabase = await createClient();
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      const response = NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 },
      );
      logRequest(supabase, req, null, 403, Date.now() - startTime);
      return response;
    }
    const [_, keyFromHeader] = authHeader.split(" ");
    if (key !== keyFromHeader) {
      const response = NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 },
      );
      logRequest(supabase, req, null, 403, Date.now() - startTime);
      return response;
    }

    try {
      let body: T = {} as T;
      let requestPayload: any = null;

      if (schema) {
        body = await req.json();
        requestPayload = body;
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          const response = NextResponse.json(
            { error: "Invalid request body: " + parsed.error },
            { status: 422 },
          );
          logRequest(
            supabase,
            req,
            null,
            422,
            Date.now() - startTime,
            null,
            requestPayload,
          );
          return response;
        }
        body = <T>parsed.data;
      }
      // Note: For requests without schema, we don't capture the payload
      // because the handler might need to read the request body itself

      const response = await handler(supabase, req, body);
      const responseTime = Date.now() - startTime;
      const statusCode =
        response instanceof NextResponse ? response.status : 200;

      logRequest(
        supabase,
        req,
        null,
        statusCode,
        responseTime,
        null,
        requestPayload,
      );

      if (response instanceof NextResponse) {
        return response;
      }
      return NextResponse.json(response ?? {});
    } catch (error: any) {
      console.error("Error processing request:", error);
      const responseTime = Date.now() - startTime;
      logRequest(
        supabase,
        req,
        null,
        500,
        responseTime,
        error.message || "Internal Server Error",
        null,
      );

      if (error.message) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 },
      );
    }
  };
}

export function requestWithAuth<T = any>(
  handler: RequestWithAuthHandler<T>,
  schema?: s.Object,
) {
  return async (req: NextRequest) => {
    const startTime = Date.now();
    const supabase = await createClient();
    const { data: getUserData } = await supabase.auth.getUser();

    const userId = getUserData?.user?.id;
    if (!userId) {
      const response = NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 },
      );
      logRequest(supabase, req, null, 403, Date.now() - startTime);
      return response;
    }

    const profile = await getProfile(supabase, userId);

    try {
      let body: T = {} as T;
      let requestPayload: any = null;

      if (schema) {
        body = await req.json();
        requestPayload = body;
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          const response = NextResponse.json(
            { error: "Invalid request body: " + parsed.error },
            { status: 422 },
          );
          logRequest(
            supabase,
            req,
            userId,
            422,
            Date.now() - startTime,
            null,
            requestPayload,
          );
          return response;
        }
        body = <T>parsed.data;
      }
      // Note: For requests without schema, we don't capture the payload
      // because the handler might need to read the request body itself

      const response = await handler(supabase, profile, req, body);
      const responseTime = Date.now() - startTime;
      const statusCode =
        response instanceof NextResponse ? response.status : 200;

      logRequest(
        supabase,
        req,
        userId,
        statusCode,
        responseTime,
        null,
        requestPayload,
      );

      if (response instanceof NextResponse) {
        return response;
      }
      return NextResponse.json(response ?? {});
    } catch (error: any) {
      console.error("Error processing request:", error);
      const responseTime = Date.now() - startTime;
      logRequest(
        supabase,
        req,
        userId,
        500,
        responseTime,
        error.message || "Internal Server Error",
        null,
      );

      if (error.message) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 },
      );
    }
  };
}

export function requestWithAuthAdmin<T = any>(
  handler: RequestWithAuthHandler<T>,
  schema?: s.Object,
) {
  return requestWithAuth(async (supabase, profile, req, body) => {
    if (!profile.is_admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    return handler(supabase, profile, req, body);
  }, schema);
}

export function requestWithProject<T = any>(
  handler: RequestWithAuthHandler<T>,
  schema?: s.Object,
  roleOrRoles?: BurnRole | BurnRole[],
) {
  return requestWithAuth(async (supabase, profile, req, body) => {
    const projectSlug = req.nextUrl.pathname.split("/")[3];
    const project = profile.projects.find((p) => p.slug === projectSlug);
    if (!project) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (roleOrRoles) {
      if (!roleMatches(project.roles, roleOrRoles)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    }
    return await handler(supabase, profile, req, body, project);
  }, schema);
}

export function requestWithMembership<T = any>(
  handler: RequestWithAuthHandler<T>,
  schema?: s.Object,
) {
  return requestWithAuth(async (supabase, profile, req, body) => {
    const projectSlug = req.nextUrl.pathname.split("/")[3];
    const project = profile.projects.find((p) => p.slug === projectSlug);
    if (!project) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (!project.membership) {
      return NextResponse.json(
        { error: "Membership required" },
        { status: 403 },
      );
    }
    return await handler(supabase, profile, req, body, project);
  }, schema);
}

function roleMatches(
  userRoles: BurnRole[],
  roleOrRoles: BurnRole | BurnRole[],
) {
  if (Array.isArray(roleOrRoles)) {
    return roleOrRoles.some((role) => userRoles.includes(role));
  } else {
    return userRoles.includes(roleOrRoles);
  }
}

export function requestWithAPIKeyAndProject<T = any>(
  handler: RequestWithAPIKeyHandler<T>,
  key: string,
  schema?: s.Object,
) {
  return requestWithAPIKey(
    async (supabase, req, body) => {
      const projectSlug = req.nextUrl.pathname.split("/")[3];
      const project = await getProjectBySlug(supabase, projectSlug);
      return await handler(supabase, req, body, project);
    },
    key,
    schema,
  );
}

export async function query(fn: () => any): Promise<any> {
  const { data, error } = await fn();

  if (error) {
    console.log(error);
    throw new Error("Failed to execute query");
  }

  return data;
}

export async function getUserIdByEmail(
  supabase: SupabaseClient,
  email: string,
) {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();
  return data?.id;
}

export async function getProjectQuestions(supabase: SupabaseClient) {
  const { data } = await supabase.from("questions").select("*");
  return data;
}

/**
 * Logs a request to the database (non-blocking, fire and forget)
 */
async function logRequest(
  supabase: SupabaseClient,
  request: NextRequest,
  userId: string | null,
  statusCode: number,
  responseTimeMs: number,
  errorMessage: string | null = null,
  payload: any = null,
) {
  // Don't await - fire and forget to avoid blocking the response
  (async () => {
    try {
      const method = request.method;
      const path = request.nextUrl.pathname;
      const userAgent = request.headers.get("user-agent") || null;

      // Get IP address from headers (check common proxy headers)
      const ipAddress = getIPAddress(request);

      // Get location from IP (non-blocking, with timeout)
      let location = null;
      if (ipAddress !== "unknown") {
        try {
          location = await Promise.race([
            getLocationFromIP(ipAddress),
            new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), 2000),
            ), // 2 second timeout
          ]);
        } catch (error) {
          // Silently fail location lookup
        }
      }

      // Sanitize payload - remove sensitive fields
      let sanitizedPayload = payload;
      if (payload && typeof payload === "object") {
        sanitizedPayload = { ...payload };
        // Limit payload size to prevent huge logs (max 10KB when stringified)
        const payloadStr = JSON.stringify(sanitizedPayload);
        if (payloadStr.length > 10000) {
          sanitizedPayload = { _truncated: true, _size: payloadStr.length };
        }
      }

      await query(() =>
        supabase.from("request_logs").insert({
          method,
          path,
          user_id: userId || null,
          ip_address: ipAddress !== "unknown" ? ipAddress : null,
          country: location?.country || null,
          region: location?.region || null,
          city: location?.city || null,
          latitude: location?.latitude || null,
          longitude: location?.longitude || null,
          user_agent: userAgent,
          status_code: statusCode,
          response_time_ms: responseTimeMs,
          error_message: errorMessage,
          request_payload: sanitizedPayload ? sanitizedPayload : null,
        }),
      );
    } catch (error) {
      // Silently fail logging to avoid breaking requests
      console.error("Failed to log request:", error);
    }
  })();
}

/**
 * Gets the IP address from request headers
 */
function getIPAddress(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");
  const cfIP = request.headers.get("cf-connecting-ip");
  return forwardedFor?.split(",")[0]?.trim() || realIP || cfIP || "unknown";
}
