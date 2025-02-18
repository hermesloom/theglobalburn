"use client";

import React from "react";
import { Sidebar } from "@/app/_components/Sidebar";
import {
  HomeOutlined,
  IdcardOutlined,
  SettingOutlined,
  QrcodeOutlined,
  TeamOutlined,
  WalletOutlined,
  FileDoneOutlined,
} from "@ant-design/icons";
import { useProject, useSession } from "@/app/_components/SessionContext";
import { redirect } from "next/navigation";
import { BurnRole, BurnStage } from "@/utils/types";

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { project } = useProject();
  const { session, isMenuVisible } = useSession();

  if (project?.type !== "burn") {
    redirect("/");
  }

  return (
    <div className="flex h-full">
      <Sidebar
        routes={[
          {
            label: "Overview",
            path: `/burn/${project?.slug}`,
            icon: <HomeOutlined />,
          },
          {
            label:
              project.membership || project.membership_purchase_right
                ? "Your membership"
                : project.burn_config.current_stage ===
                      BurnStage.OpenSaleLotteryEntrantsOnly ||
                    project.burn_config.current_stage ===
                      BurnStage.OpenSaleGeneral
                  ? "Open membership sale"
                  : "Membership lottery",
            path: `/burn/${project?.slug}/membership`,
            icon: <IdcardOutlined />,
          },

          ...(project.roles.includes(BurnRole.MembershipScanner)
            ? ([
                { separator: true },
                { sectionTitle: "On-site" },
                {
                  label: "Membership scanner",
                  path: `/burn/${project?.slug}/scanner`,
                  icon: <QrcodeOutlined />,
                },
              ] as any)
            : []),

          ...(project.roles.includes(BurnRole.MembershipManager)
            ? ([
                { separator: true },
                { sectionTitle: "Membership management" },
                project.burn_config.current_stage !==
                  BurnStage.OpenSaleLotteryEntrantsOnly &&
                project.burn_config.current_stage !== BurnStage.OpenSaleGeneral
                  ? {
                      label: "Lottery tickets",
                      path: `/burn/${project?.slug}/admin/lottery-tickets`,
                      icon: <WalletOutlined />,
                    }
                  : null,
                {
                  label: "Membership purchase rights",
                  path: `/burn/${project?.slug}/admin/membership-purchase-rights`,
                  icon: <FileDoneOutlined />,
                },
                {
                  label: "Memberships",
                  path: `/burn/${project?.slug}/admin/memberships`,
                  icon: <TeamOutlined />,
                },
              ] as any)
            : []),

          ...(project.roles.includes(BurnRole.Admin)
            ? ([
                { separator: true },
                { sectionTitle: "Administration" },
                {
                  label: "Configuration",
                  path: `/burn/${project?.slug}/admin/config`,
                  icon: <SettingOutlined />,
                },
              ] as any)
            : []),
          ,
        ]}
      />
      <div
        className={`flex-1 ${isMenuVisible ? "pl-96" : ""} h-full`}
        style={{ paddingLeft: isMenuVisible ? "24rem" : "10rem" }}
      >
        {children}
      </div>
    </div>
  );
}
