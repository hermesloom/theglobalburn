"use client";

import { useEffect, useState } from "react";
import { useProject } from "@/app/_components/SessionContext";
import { apiGet, apiPost } from "@/app/_components/api";
import { Spinner } from "@nextui-org/react";
import Heading from "@/app/_components/Heading";
import { CopyOutlined, CheckOutlined } from "@ant-design/icons";
import Link from "next/link";

interface NoteEntry {
  id: string;
  created_at: string;
  membership_id: string | null;
  member_name: string | null;
  actor_name: string;
  note: string;
  special_circumstances: boolean;
}

function formatNoteDate(dateStr: string): string {
  const date = new Date(dateStr);
  const opts = { timeZone: "Europe/Stockholm" } as const;
  const parts = new Intl.DateTimeFormat("en-US", {
    ...opts, weekday: "long", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, year: "numeric",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const tz = new Intl.DateTimeFormat("sv-SE", { ...opts, timeZoneName: "short" })
    .formatToParts(date).find((p) => p.type === "timeZoneName")?.value ?? "";
  return `${get("weekday")}, ${get("month")} ${get("day")}, ${get("hour")}:${get("minute")}:${get("second")} ${tz} (${get("year")})`;
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
  const [newNote, setNewNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadNotes = () => {
    if (!project?.slug) return;
    setLoading(true);
    apiGet(`/burn/${project.slug}/admin/membership-notes`)
      .then((data: NoteEntry[]) => {
        setNotes(data);
        setError(null);
      })
      .catch((err: any) => setError(err.message || "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadNotes(); }, [project?.slug]);

  const handleAddNote = async () => {
    if (!newNote.trim() || !project?.slug) return;
    setSubmitting(true);
    try {
      await apiPost(`/burn/${project.slug}/admin/membership-notes`, { note: newNote.trim() });
      setNewNote("");
      loadNotes();
    } catch (err: any) {
      setError(err.message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

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
      <Link href={`/burn/${project?.slug}/membership_tools`} className="text-sm text-blue-600 hover:underline mb-4 inline-block">
        ← Back to Membership Tools
      </Link>
      <Heading>Note Log</Heading>
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <p className="text-red-600 font-semibold mb-2">⚠ These notes are for facts, not opinions (REMEMBER: any member can request their data via GDPR)</p>
        <textarea
          className="w-full border border-gray-300 rounded p-2 text-sm resize-none"
          rows={3}
          placeholder="Add a general note (e.g. a note about somebody who isn't a member)..."
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
        />
        <button
          onClick={handleAddNote}
          disabled={submitting || !newNote.trim()}
          className="mt-2 px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Add Note"}
        </button>
      </div>
      {notes && notes.length === 0 ? (
        <div className="text-gray-500">No notes yet.</div>
      ) : (
        <div className="space-y-3">
          {(notes || []).map((n) => (
            <div key={n.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                {n.member_name ? (
                  <span className="font-semibold text-gray-800">{n.member_name}</span>
                ) : (
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">General note</span>
                )}
                <div className="text-right">
                  <div className="text-sm text-gray-500">{formatNoteDate(n.created_at)}</div>
                  <div className="text-xs text-gray-400">by {n.actor_name}</div>
                </div>
              </div>
              {n.special_circumstances && (
                <span className="inline-block text-xs font-semibold text-orange-700 bg-orange-100 border border-orange-300 rounded px-2 py-0.5 mb-2">Gate will be informed of special circumstances</span>
              )}
              <div className="flex items-start gap-2">
                <p className="text-gray-700 whitespace-pre-wrap flex-1">{n.note}</p>
                <CopyButton text={n.member_name ? `${n.member_name}:\n${n.note}\n— ${n.actor_name}` : `${n.note}\n— ${n.actor_name}`} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
