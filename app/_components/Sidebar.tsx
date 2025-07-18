"use client";

import { Button } from "@nextui-org/react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "./SessionContext";
import { isMobileDevice } from "./isMobileDevice";

interface SidebarRoute {
  label: string;
  path: string;
  icon: React.ReactNode;
}

interface SidebarProps {
  routes: (SidebarRoute | { separator: true } | { sectionTitle: string })[];
}

export function Sidebar({ routes }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { showSidebar, setShowSidebar } = useSession();

  return (
    <div
      className="fixed h-full border-r border-divider p-4 z-2 rounded-r-xl transition-all duration-300"
      style={{
        width: "16rem",
        backgroundColor: "#FCFCFC",
        boxShadow: showSidebar ? "0px 0px 20px rgba(0, 0, 0, 0.05)" : "none",
        left: showSidebar ? "4rem" : "-16rem",
      }}
    >
      <div className="flex flex-col gap-2">
        {routes.map((route: any, i) =>
          route === null ? null : route.separator ? (
            <div
              key={i}
              className="h-[1px] w-full my-2"
              style={{ backgroundColor: "#E0E0E0" }}
            />
          ) : route.sectionTitle ? (
            <div
              key={i}
              className="text-[10px] text-default-500 mt-1 ml-4 uppercase"
            >
              {route.sectionTitle}
            </div>
          ) : (
            <Button
              key={route.path}
              variant="light"
              className={`justify-start ${
                pathname === route.path ? "bg-content3 font-bold" : ""
              }`}
              onPress={() => {
                router.push(route.path);
                if (isMobileDevice()) {
                  setShowSidebar(false);
                }
              }}
              startContent={route.icon}
            >
              <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                {route.label}
              </span>
            </Button>
          ),
        )}
      </div>
    </div>
  );
}
