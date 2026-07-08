"use client";

import { useEffect, useState } from "react";
import { useProject } from "@/app/_components/SessionContext";
import { apiGet } from "@/app/_components/api";
import { Spinner } from "@nextui-org/react";
import Heading from "@/app/_components/Heading";
import { CopyOutlined, CheckOutlined } from "@ant-design/icons";

interface NoteEntry {
  id: string;
  created_at: string;
  membership_id: string;
  member_name: string;
  actor_name: string;
  note: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="text-gray-400 hover:text-gray-600 transition-colors"
      title="Copy note"
    >
      {copied ? <CheckOutlined style={{ color: "#22c55e" }} /> : <CopyOutlined />}
    </button>
  );
}

export default function NoteLogPage() {
  const { project } = useProject();
  const [notes, setNotes] = useState<NoteEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!project?.slug) return;
    setLoading(true);
    apiGet(`/burn/${project.slug}/admin/membership-notes`)
      .then((data: NoteEntry[]) => {
        setNotes(data);
        setError(null);
      })
      .catch((err: any) => setError(err.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, [project?.slug]);

  if (loading) {
    return (
      <>
        <Heading>Note Log</Heading>
        <div className="flex justify-center items-center py-8">
          <Spinner size="lg" />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Heading>Note Log</Heading>
        <div className="text-red-500">Error: {error}</div>
      </>
    );
  }

  return (
    <>
      <Heading>Note Log</Heading>
      {notes && notes.length === 0 ? (
        <div className="text-gray-500">No notes yet.</div>
      ) : (
        <div className="space-y-3">
          {(notes || []).map((n) => (
            <div key={n.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                <span className="font-semibold text-gray-800">{n.member_name}</span>
                <div className="text-right">
                  <div className="text-sm text-gray-500">{new Date(n.created_at).toLocaleString("sv-SE", { timeZone: "Europe/Stockholm", timeZoneName: "short" })}</div>
                  <div className="text-xs text-gray-400">by {n.actor_name}</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <p className="text-gray-700 whitespace-pre-wrap flex-1">{n.note}</p>
                <CopyButton text={`${n.member_name}:\n${n.note}\n— ${n.actor_name}`} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
