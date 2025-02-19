"use client";

import { Sidebar } from "@/app/_components/Sidebar";
import {
  UserOutlined,
  FireOutlined,
  ContactsOutlined,
  UserSwitchOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import ContentContainer from "@/app/_components/ContentContainer";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full">
      <Sidebar
        routes={[
          {
            label: "Users",
            path: "/admin/users",
            icon: <UserOutlined />,
          },
          {
            label: "Projects",
            path: "/admin/projects",
            icon: <FireOutlined />,
          },
          {
            label: "Roles",
            path: "/admin/roles",
            icon: <ContactsOutlined />,
          },
          {
            label: "Role assignments",
            path: "/admin/role-assignments",
            icon: <UserSwitchOutlined />,
          },
          {
            label: "Burner questions",
            path: "/admin/questions",
            icon: <QuestionCircleOutlined />,
          },
        ]}
      />
      <ContentContainer>{children}</ContentContainer>
    </div>
  );
}
