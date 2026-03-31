"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

export default function ThresholdPage() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const params = useParams();
  const slug = params.slug as string;
  const searchParams = useSearchParams();

  const path = searchParams.get('path') || '/';

  // Get Threshold URL from environment variable with fallback
  const thresholdBaseUrl =
    process.env.NEXT_PUBLIC_THRESHOLD_URL || "https://threshold.theborderland.se";

  useEffect(() => {
    // Fetch JWT token for Threshold authentication
    const fetchToken = async () => {
      try {
        const response = await fetch(
          `/api/auth/rea-token?burn=${encodeURIComponent(slug)}&service=threshold`
        );
        if (!response.ok) {
          throw new Error("Failed to generate authentication token");
        }
        const data = await response.json();
        setToken(data.token);
      } catch (err: any) {
        console.error("Error fetching Threshold token:", err);
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

  const iframeUrl = `${thresholdBaseUrl}${path}?token=${encodeURIComponent(token || "")}`;

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

