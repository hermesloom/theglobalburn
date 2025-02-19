import React from "react";
import { useSession } from "./SessionContext";

export default function ContentContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  const { showSidebar } = useSession();

  return (
    <div
      className="fixed p-14 h-full transition-all duration-300"
      style={{
        overflow: "hidden auto",
        left: showSidebar ? "20rem" : "0px",
        width: showSidebar ? "calc(100% - 20rem)" : "100%",
      }}
    >
      <div style={{ minWidth: "10rem" }}>{children}</div>
    </div>
  );
}
