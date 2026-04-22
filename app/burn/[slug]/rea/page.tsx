"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { buildReaUrl, getReaBaseUrl } from "@/utils/rea";

export default function REAPage() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const params = useParams();
  const searchParams = useSearchParams();

  const slug = params.slug as string;
  const realityId = searchParams.get('reality_id') || '';

  useEffect(() => {
    // Fetch JWT token for REA authentication
    const fetchToken = async () => {
      try {
        const response = await fetch(`/api/auth/rea-token?burn=${encodeURIComponent(slug)}&service=rea`);
        if (!response.ok) {
          throw new Error("Failed to generate authentication token");
        }
        const data = await response.json();
        setToken(data.token);
      } catch (err: any) {
        console.error("Error fetching REA token:", err);
        setError("Authentication failed");
      } finally {
        setLoading(false);
      }
    };

    fetchToken();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  // Construct iframe URL with JWT token - go directly to sign-up to avoid redirect
  const iframeUrl = buildReaUrl("/sign-up", token || "", realityId);

  return (
    <div className="-m-14 w-[calc(100%+7rem)] h-[calc(100vh)]">
      <iframe
        src={iframeUrl}
        className="w-full h-full border-0"
        allow="fullscreen"
      />
    </div>
  );
}
