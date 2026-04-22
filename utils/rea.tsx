"use client";

import { useEffect, useState } from "react";

/**
 * REA Service Utilities
 * Shared utilities for interacting with the REA service
 */

export interface ReaUserInfo {
  shifts_count: number | null;
}

export interface UseReaUserInfoResult {
  userInfo: ReaUserInfo | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Get the REA base URL from environment variable with fallback
 */
export function getReaBaseUrl(): string {
  return process.env.NEXT_PUBLIC_REA_URL || "https://rea.theborderland.se";
}

/**
 * Build a complete REA URL with token and optional reality_id
 */
export function buildReaUrl(
  path: string,
  token: string,
  realityId?: string
): string {
  const baseUrl = getReaBaseUrl();
  const params = new URLSearchParams();

  if (realityId) {
    params.append("reality_id", realityId);
  }

  params.append("token", token);

  return `${baseUrl}${path}?${params.toString()}`;
}

/**
 * React hook to fetch current user information from REA
 * Returns null if there is no current user, or an object with shifts_count
 */
export function useReaUserInfo(burnSlug?: string): UseReaUserInfoResult {
  const [userInfo, setUserInfo] = useState<ReaUserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        let token: string | null = null;

        if (burnSlug) {
          const tokenResponse = await fetch(
            `/api/auth/rea-token?burn=${encodeURIComponent(burnSlug)}&service=rea`
          );
          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            token = tokenData.token;
          }
        }

        const reaBaseUrl = getReaBaseUrl();
        const url = token
          ? `${reaBaseUrl}/api/me?token=${encodeURIComponent(token)}`
          : `${reaBaseUrl}/api/me`;
        const response = await fetch(url, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch user info: ${response.status}`);
        }

        const data = await response.json();

        // Response is either null (no user) or { shifts_count: number }
        setUserInfo(data);
      } catch (err) {
        console.error("Error fetching REA user info:", err);
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setLoading(false);
      }
    };

    fetchUserInfo();
  }, [burnSlug]);

  return { userInfo, loading, error };
}
