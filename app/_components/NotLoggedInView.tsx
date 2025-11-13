"use client";

import React, { useState } from "react";
import { Modal, ModalContent, ModalBody, Button } from "@nextui-org/react";
import Auth from "./auth/Auth";
import { useSession } from "./SessionContext";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  const { session } = useSession();
  const [isOpen, setIsOpen] = useState(false);

  if (session) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 z-0"
      style={{
        backgroundImage: 'url("/Secret-Garden-Bridge.webp")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div
        className="flex flex-col items-center justify-center min-h-screen z-1"
        style={{ backdropFilter: "blur(10px)" }}
      >
        <Image
          src="/borderland-2026.png"
          alt="The Borderland"
          width={100}
          height={100}
          className="rounded-2xl"
        />
        <h1
          className="text-4xl font-bold mt-4 text-white"
          style={{ filter: "drop-shadow(0 0 10px black)" }}
        >
          The Borderland
        </h1>
        <h2
          className="mt-2 mb-4 text-white"
          style={{ filter: "drop-shadow(0 0 10px black)" }}
        >
          Membership platform
        </h2>
        <Button color="primary" onPress={() => setIsOpen(true)}>
          Click to sign up or login
        </Button>
        <Modal
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          classNames={{
            base: "m-0",
            wrapper: "items-center",
          }}
        >
          <ModalContent className="m-4">
            <ModalBody>
              <Auth />
            </ModalBody>
          </ModalContent>
        </Modal>
        <div className="absolute bottom-0 right-0 p-4 text-xs">
          <Link href="/privacy">Privacy policy</Link>
        </div>
      </div>
    </div>
  );
}
