import React from "react";
import { Button, Tooltip } from "@nextui-org/react";
import {
  SettingOutlined,
  LogoutOutlined,
  GithubOutlined,
  SafetyCertificateOutlined,
  MenuOutlined,
} from "@ant-design/icons";
import AddProjectButton from "./AddProjectButton";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useSession } from "../SessionContext";
export default function ProjectSwitcher() {
  const supabase = createClient();
  const router = useRouter();
  const { profile } = useSession();
  const {isMenuVisible} = useSession();
  
  const { toggleMenu } = useSession();
  return (
    <div
      className="fixed w-[72px] h-full bg-content2 flex flex-col items-center py-3 gap-4 border-r border-divider"
      style={{
        zIndex: 1,
        boxShadow: "0px 0px 20px rgba(0, 0, 0, 0.1)",
      }}
    >
       <>
       <Tooltip content="Toggle menu" placement="right">
      <Button
      isIconOnly
      radius="full"
      variant="light"
      className="bg-default-100 hover:bg-default-200"
       onPress={() => toggleMenu()}
       startContent={<MenuOutlined />}
          >
      
      
          </Button>
      </Tooltip>
      </>
      {profile?.is_admin ? (
        <>
          <Tooltip content="Administration" placement="right">
            <Button
              isIconOnly
              radius="full"
              variant="light"
              className="bg-default-100 hover:bg-default-200"
              onPress={() => router.push("/admin/users")}
            >
              <SettingOutlined style={{ fontSize: "20px" }} />
            </Button>
          </Tooltip>

          <div className="w-8 h-[2px] bg-divider rounded-full my-1" />
        </>
      ) : null}

      {profile?.projects.map((p) => (
        <Tooltip key={p.id} content={p.name} placement="right">
          <Button
            isIconOnly
            radius="full"
            variant="light"
            className="bg-white hover:bg-default-200 p-1"
            onPress={() => router.push(`/${p.type}/${p.slug}`)}
          >
            <div className="w-full h-full relative">
              <Image
                src="/borderland.png"
                alt={p.name}
                fill
                className="object-contain"
              />
            </div>
          </Button>
        </Tooltip>
      ))}

      <AddProjectButton />

      {/* Spacer to push sign out to bottom */}
      <div className="flex-grow" />

      <Tooltip content="GitHub" placement="right">
        <Button
          isIconOnly
          radius="full"
          variant="light"
          className="bg-default-50 hover:bg-default-200"
          onPress={() =>
            window.open("https://github.com/hermesloom/theglobalburn", "_blank")
          }
        >
          <GithubOutlined style={{ fontSize: "20px" }} />
        </Button>
      </Tooltip>

      <Tooltip content="Privacy policy" placement="right">
        <Button
          isIconOnly
          radius="full"
          variant="light"
          className="bg-default-50 hover:bg-default-200"
          onPress={() => window.open("/privacy", "_blank")}
        >
          <SafetyCertificateOutlined style={{ fontSize: "20px" }} />
        </Button>
      </Tooltip>

      <Tooltip content="Sign out" placement="right">
        <Button
          isIconOnly
          radius="full"
          variant="light"
          className="bg-danger/10 hover:bg-danger/20 text-danger"
          onPress={() => supabase!.auth.signOut()}
        >
          <LogoutOutlined style={{ fontSize: "20px" }} />
        </Button>
      </Tooltip>
    </div>
  );
}
