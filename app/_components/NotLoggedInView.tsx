"use client";

import React, { useState } from "react";
import { Button } from "@nextui-org/react";
import { useSession } from "./SessionContext";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type ErrorInfo = { title: string; body: string };

const ERROR_MESSAGES: Record<string, ErrorInfo> = {
  no_code: {
    title: "Authentication Failed",
    body: "No authorization code was received from the authentication server.",
  },
  config_error: {
    title: "Configuration Error",
    body: "The authentication service is not configured properly. Please contact support.",
  },
  auth_failed: {
    title: "Authentication Failed",
    body: "Failed to complete authentication. Please try again.",
  },
  invalid_state: {
    title: "Security Error",
    body: "Security validation failed. This may be a CSRF attack attempt. Please try again.",
  },
};

const DEFAULT_ERROR: ErrorInfo = {
  title: "Error",
  body: "An unexpected error occurred. Please try again.",
};

export default function Home() {
  const { session } = useSession();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const searchParams = useSearchParams();
  const error = searchParams?.get("error");

  if (session) {
    return null;
  }

  const handleLogin = () => {
    setIsRedirecting(true);
    // Redirect directly to the OAuth login endpoint
    window.location.href = "/api/auth/login";
  };

  const errorInfo = error
    ? (ERROR_MESSAGES[error] ?? DEFAULT_ERROR)
    : null;

  return (
    <div
      className="absolute inset-0 z-0"
      style={{
        backgroundImage: 'url("/Secret-Garden-Bridge.webp")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div
        className="flex flex-col items-center justify-center min-h-screen z-1 px-4"
        style={{ backdropFilter: "blur(10px)" }}
      >
        <Image
          src="/borderland-2026.png"
          alt="The Borderland"
          width={100}
          height={100}
          className="rounded-2xl"
        />
        <h1
          className="text-4xl font-bold mt-4 text-white"
          style={{ filter: "drop-shadow(0 0 10px black)" }}
        >
          The Borderland
        </h1>
        <h2
          className="mt-2 mb-4 text-white"
          style={{ filter: "drop-shadow(0 0 10px black)" }}
        >
          Membership platform
        </h2>
        {errorInfo && (
          <div className="mb-4 p-4 rounded-lg bg-danger-50 border border-danger-200 max-w-md">
            <p className="text-sm text-danger-700 font-semibold mb-1">
              {errorInfo.title}
            </p>
            <p className="text-sm text-danger-600">{errorInfo.body}</p>
          </div>
        )}
        <Button
          color="primary"
          onPress={handleLogin}
          isLoading={isRedirecting}
          isDisabled={isRedirecting}
        >
          {isRedirecting ? "Redirecting..." : "Click to sign up or login"}
        </Button>
        <div className="absolute bottom-0 right-0 p-4 text-xs">
          <Link href="/privacy">Privacy policy</Link>
        </div>
      </div>
    </div>
  );
}
