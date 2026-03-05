"use client";

import React, { useState, useEffect } from "react";
import Heading from "@/app/_components/Heading";
import { Button, Spinner } from "@nextui-org/react";
import { useProject } from "@/app/_components/SessionContext";
import { apiGet } from "@/app/_components/api";
import { FileTextOutlined } from "@ant-design/icons";

interface BoardMeetingNote {
  id: string;
  name: string;
  mimeType: string;
  url: string;
}

export default function BoardMeetingNotesPage() {
  const { project } = useProject();
  const [files, setFiles] = useState<BoardMeetingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFiles = async () => {
      if (!project?.slug) return;

      try {
        setLoading(true);
        const response = await apiGet(
          `/burn/${project.slug}/board-meeting-notes`,
        );
        setFiles(response.data || []);
        setError(null);
      } catch (err: any) {
        setError(err.message || "Failed to load board meeting notes");
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, [project?.slug]);

  if (loading) {
    return (
      <>
        <Heading>Board Meeting Notes</Heading>
        <div className="flex justify-center items-center py-8">
          <Spinner size="lg" />
        </div>
      </>
    );
  }

  return (
    <>
      <Heading>Board Meeting Notes</Heading>

      {error && (
        <p className="text-red-500 mb-4">{error}</p>
      )}

      {files.length === 0 && !error && (
        <p className="text-gray-500">No board meeting notes available yet.</p>
      )}

      <div className="flex flex-col gap-2">
        {files.map((file) => (
          <Button
            key={file.id}
            as="a"
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            variant="bordered"
            className="justify-start"
            startContent={<FileTextOutlined />}
          >
            {file.name}
          </Button>
        ))}
      </div>
    </>
  );
}
