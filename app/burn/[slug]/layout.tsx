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
  HeartOutlined,
} from "@ant-design/icons";
import { useProject } from "@/app/_components/SessionContext";
import { redirect } from "next/navigation";
import { BurnRole, BurnStage } from "@/utils/types";
import ContentContainer from "@/app/_components/ContentContainer";
import { useReaUserInfo } from "@/utils/rea";

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { project, profile } = useProject();
  const { userInfo, loading: reaLoading } = useReaUserInfo();

  if (project?.type !== "burn") {
    redirect("/");
  }

  const noREAShifts = !reaLoading && userInfo?.shifts_count === 0;

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
                  ? "Spring Membership Sale"
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
          !project.membership &&
            (project.burn_config.current_stage ===
              BurnStage.OpenSaleLotteryEntrantsOnly ||
              project.burn_config.current_stage === BurnStage.OpenSaleGeneral)
            ? {
              label: "Low Income Support",
              path: `/burn/${project?.slug}/low-income-support`,
              icon: <HeartOutlined />,
            }
            : null,
          {
            label: "Links",
            path: `/burn/${project?.slug}/links`,
            icon: <LinkOutlined />,
          },
          /*project.membership
            ? {
              label: "Board Meeting Notes",
              path: `/burn/${project?.slug}/board-meeting-notes`,
              icon: <FileTextOutlined />,
            }
            : null,*/
          project.membership || profile?.email === "ml@semi-sentient.com"
            ? {
              label: "Co-Create",
              path: `/burn/${project?.slug}/rea`,
              icon: <RocketOutlined />,
              warning: (noREAShifts ? "You haven't signed up for any shifts" : null),
            }
            : null,
          // profile?.email === "ml@semi-sentient.com"
          //   ? {
          //     label: "Gate Scanner",
          //     path: `/burn/${project?.slug}/scanner`,
          //     icon: <RocketOutlined />,
          //   }
          //   : null,
          {
            label: "Newsletter",
            path: `/burn/${project?.slug}/newsletter`,
            icon: <MailOutlined />,
          },
          project.membership
            ? {
              label: "Statistics",
              path: `/burn/${project?.slug}/statistics`,
              icon: <BarChartOutlined />,
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

          project.roles.includes(BurnRole.MembershipScanner) ||
            project.roles.includes(BurnRole.ThresholdWatcher)
            ? {
              label: "Membership Scanner",
              path: `/burn/${project?.slug}/threshold?path=/scanner`,
              icon: <RocketOutlined />,
            }
            : null,

          project.roles.includes(BurnRole.ThresholdWatcher)
            ? {
              label: "Watcher Tools",
              path: `/burn/${project?.slug}/threshold?path=/watcher-tools`,
              icon: <RocketOutlined />,
            }
            : null,

          // ...(project.roles.includes(BurnRole.MembershipScanner)
          //   ? ([
          //     {
          //       label: "Membership scanner",
          //       path: `/burn/${project?.slug}/scanner`,
          //       icon: <QrcodeOutlined />,
          //     },
          //   ] as any)
          //   : []),

          ...(project.roles.includes(BurnRole.ThresholdWatcher)
            ? ([
              // {
              //   label: "Watcher Tools",
              //   path: `/burn/${project?.slug}/watcher_tools`,
              //   icon: <MonitorOutlined />,
              // },
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
        ].filter((x) => !!x)}
      />
      <ContentContainer>{children}</ContentContainer>
    </>
  );
}
