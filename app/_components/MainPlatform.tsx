"use client";

import React from "react";
import ProjectSwitcher from "./projectswitcher/ProjectSwitcher";
import FullScreenSpinner from "./FullScreenSpinner";
import NotLoggedInView from "./NotLoggedInView";
import { useSession } from "./SessionContext";
import { usePathname } from "next/navigation";

export default function MainPlatform({
  children,
}: {
  children?: React.ReactNode;
}) {
  const { session, isLoading } = useSession();
  const pathname = usePathname();

  if (isLoading) {
    return <FullScreenSpinner />;
  } else if (!session && pathname !== "/privacy") {
    return <NotLoggedInView />;
  }

  // For privacy page, only show children
  if (pathname === "/privacy") {
    return <div className="flex-1">{children}</div>;
  }

  // For all other routes, show normal layout with ProjectSwitcher
  return (
    <>
      <ProjectSwitcher />
      {children}
    </>
  );
}
