import React from "react";
import { Button } from "@nextui-org/react";

export default function SignOutButton() {
  const handleSignOut = async () => {
    // Call the logout API endpoint which clears both Supabase session and SSO cookie
    await fetch("/api/auth/logout", { method: "POST" });
    // Redirect to home page
    window.location.href = "/";
  };

  return (
    <Button color="danger" onPress={handleSignOut}>
      Sign out
    </Button>
  );
}
