"use client";

import React from "react";
import { Sidebar } from "@/app/_components/Sidebar";
import {
  HomeOutlined,
  IdcardOutlined,
  SettingOutlined,
  QrcodeOutlined,
  BaiduOutlined,
  MonitorOutlined,
  TeamOutlined,
  WalletOutlined,
  FileDoneOutlined,
  LinkOutlined,
  PlusOutlined,
  BarChartOutlined,
  MailOutlined,
  RocketOutlined,
} from "@ant-design/icons";
import { useProject } from "@/app/_components/SessionContext";
import { redirect } from "next/navigation";
import { BurnRole, BurnStage } from "@/utils/types";
import ContentContainer from "@/app/_components/ContentContainer";

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { project, profile } = useProject();

  if (project?.type !== "burn") {
    redirect("/");
  }

  return (
    <>
      <Sidebar
        routes={[
          {
            label: "Timeline",
            path: `/burn/${project?.slug}`,
            icon: <HomeOutlined />,
          },
          {
            label:
              project.membership || project.membership_purchase_right
                ? "Your Membership"
                : project.burn_config.current_stage ===
                  BurnStage.OpenSaleLotteryEntrantsOnly ||
                  project.burn_config.current_stage ===
                  BurnStage.OpenSaleGeneral
                  ? "Open Membership Sale"
                  : project.burn_config.current_stage ===
                    BurnStage.OpenSaleNonTransferable
                    ? "Fall Membership Sale"
                    : "Membership Lottery",
            path: `/burn/${project?.slug}/membership`,
            icon: <IdcardOutlined />,
          },
          project.membership ||
            project.membership_purchase_right ||
            project.burn_config.current_stage !==
            BurnStage.OpenSaleNonTransferable
            ? null
            : {
              label: "Spring Membership Sale",
              path: `/burn/${project?.slug}/spring-membership-info`,
              icon: <IdcardOutlined />,
            },
          {
            label: "Links",
            path: `/burn/${project?.slug}/links`,
            icon: <LinkOutlined />,
          },
          project.membership
            ? {
              label: "Statistics",
              path: `/burn/${project?.slug}/statistics`,
              icon: <BarChartOutlined />,
            }
            : null,
          {
            label: "Newsletter",
            path: `/burn/${project?.slug}/newsletter`,
            icon: <MailOutlined />,
          },
          profile?.email === "ml@semi-sentient.com"
            ? {
              label: "Volunteer",
              path: `/burn/${project?.slug}/rea`,
              icon: <RocketOutlined />,
            }
            : null,
          project.membership
            ? {
              label: "Have an idea?",
              path: `/burn/${project?.slug}/ideas`,
              icon: <PlusOutlined />,
            }
            : null,

          ...(project.roles.includes(BurnRole.MembershipScanner) ||
            project.roles.includes(BurnRole.ThresholdWatcher)
            ? ([{ separator: true }, { sectionTitle: "On-site" }] as any)
            : []),

          ...(project.roles.includes(BurnRole.MembershipScanner)
            ? ([
              {
                label: "Membership scanner",
                path: `/burn/${project?.slug}/scanner`,
                icon: <QrcodeOutlined />,
              },
            ] as any)
            : []),

          ...(project.roles.includes(BurnRole.ThresholdWatcher)
            ? ([
              {
                label: "Watcher Tools",
                path: `/burn/${project?.slug}/watcher_tools`,
                icon: <MonitorOutlined />,
              },
              {
                label: "Pet search",
                path: `/burn/${project?.slug}/pet_search`,
                icon: <BaiduOutlined />,
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
        ].filter((x) => !!x)}
      />
      <ContentContainer>{children}</ContentContainer>
    </>
  );
}
