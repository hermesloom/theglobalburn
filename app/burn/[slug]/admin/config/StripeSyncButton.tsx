"use client";

import React, { useState } from "react";
import { Button } from "@nextui-org/react";
import { useProject } from "@/app/_components/SessionContext";
import { apiPost } from "@/app/_components/api";
import toast from "react-hot-toast";

/** Stops a bug in the loop condition from hammering Stripe forever. */
const MAX_SLICES = 200;

export default function StripeSyncButton() {
  const { project } = useProject();
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const sync = async (mode: "full" | "incremental") => {
    setIsSyncing(true);
    setProgress("Starting…");
    try {
      for (let slice = 0; slice < MAX_SLICES; slice++) {
        const result = await apiPost(`/burn/${project?.slug}/admin/stripe-sync`, {
          mode,
        });
        const synced = Object.entries(result.counts ?? {})
          .map(([name, count]) => `${name}: ${count}`)
          .join(", ");
        if (result.done) {
          setProgress(`Done. ${synced}`);
          toast.success("Stripe data synchronized");
          return;
        }
        setProgress(`Syncing ${result.resource ?? "…"} — ${synced}`);
      }
      toast.error("Sync did not finish within the expected number of slices");
    } catch {
      // apiFetch already surfaces the error as a toast
      setProgress("Failed. Press again to resume where it stopped.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <Button
        color="secondary"
        isLoading={isSyncing}
        onPress={() => sync("incremental")}
      >
        Synchronize Stripe data
      </Button>
      <Button
        color="secondary"
        variant="bordered"
        isDisabled={isSyncing}
        onPress={() => sync("full")}
      >
        Full Stripe re-sync (slow)
      </Button>
      {progress && <div className="text-sm text-gray-600">{progress}</div>}
    </>
  );
}
