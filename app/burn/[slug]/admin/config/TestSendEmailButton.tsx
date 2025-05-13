"use client";

import React, { useState } from "react";
import { Button } from "@nextui-org/react";
import toast from "react-hot-toast";
import { apiGet } from "@/app/_components/api";

export default function TestSendEmailButton() {
  const [isLoading, setIsLoading] = useState<boolean>(false);

  return (
    <Button
      isLoading={isLoading}
      onPress={async () => {
        setIsLoading(true);
        try {
          await apiGet("/admin/test-send-email");
          toast.success("Email sent!");
        } catch (e) {
          console.error(e);
          toast.error("Error sending email (see console)");
        } finally {
          setIsLoading(false);
        }
      }}
    >
      Test sending an email
    </Button>
  );
}
