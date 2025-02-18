"use client";

import { ConsoleSqlOutlined, MenuOutlined } from "@ant-design/icons";
import { Button } from "@nextui-org/react";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { useSession } from "./SessionContext";

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
  const { session, isMenuVisible } = useSession();
  
  return (
    <div
      className={`fixed h-full left-[72px] ${isMenuVisible ? "w-64" : "w-10"} border-r border-divider p-4 z-2 rounded-r-xl`}
      style={{
      backgroundColor: "#FCFCFC",
      boxShadow: "0px 0px 20px rgba(0, 0, 0, 0.05)",
      }}
    >
      <div className="flex flex-col gap-2">
      {isMenuVisible && (
        <div className="menu-content">
        {/* Menu content goes here */}
        </div>
      )}
      {routes.map((route: any, i) =>
        route === null ? null : route.separator ? (
        <div
          key={i}
          className="h-[1px] w-full my-2"
          style={{ backgroundColor: "#E0E0E0" }}
        />
        ) : route.sectionTitle ? (
        isMenuVisible && (
          <div
          key={i}
          className="text-[10px] text-default-500 mt-1 ml-4 uppercase"
          >
          {route.sectionTitle}
          </div>
        )
        ) : (
        <Button
          isIconOnly={!isMenuVisible}
          key={route.path}
          variant="light"
          className={`justify-start ${
          pathname === route.path ? "bg-content3 font-bold" : ""
          }`}
          onPress={() => router.push(route.path)}
          startContent={route.icon}
        >
          {isMenuVisible && (
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">
            {route.label}
          </span>
          )}
        </Button>
        )
      )}
      </div>
    </div>
  );
}
