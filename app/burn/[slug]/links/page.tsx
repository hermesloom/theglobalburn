"use client";

import React, { useState, useEffect } from "react";
import Heading from "@/app/_components/Heading";
import {
  Button,
  Input,
  Textarea,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Spinner,
  Alert,
} from "@nextui-org/react";
import { useProject } from "@/app/_components/SessionContext";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/app/_components/api";
import { EditOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";

interface BurnLink {
  id: string;
  label: string;
  url: string;
  description: string | null;
  emoji: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export default function LinksPage() {
  const { project } = useProject();
  const [links, setLinks] = useState<BurnLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editingLink, setEditingLink] = useState<BurnLink | null>(null);
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);
  const [savingLink, setSavingLink] = useState(false);
  const [draggedLinkId, setDraggedLinkId] = useState<string | null>(null);
  const [dragOverLinkId, setDragOverLinkId] = useState<string | null>(null);
  const [insertPosition, setInsertPosition] = useState<"before" | "after">("after");
  const [isReordering, setIsReordering] = useState(false);
  const {
    isOpen: isModalOpen,
    onOpen: onModalOpen,
    onClose: onModalClose,
  } = useDisclosure();

  const hasMembership = !!project?.membership;

  const loadLinks = async () => {
    try {
      setLoading(true);
      const response = await apiGet(`/burn/${project?.slug}/links`);
      setLinks(response.data || []);
    } catch (error) {
      console.error("Failed to load links:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (project?.slug) {
      loadLinks();
    }
  }, [project?.slug]);

  const handleAddLink = () => {
    setEditingLink(null);
    onModalOpen();
  };

  const handleEditLink = (link: BurnLink) => {
    setEditingLink(link);
    onModalOpen();
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!confirm("Are you sure you want to delete this link?")) {
      return;
    }
    try {
      setDeletingLinkId(linkId);
      await apiDelete(`/burn/${project?.slug}/links/${linkId}`);
      await loadLinks();
    } catch (error) {
      console.error("Failed to delete link:", error);
    } finally {
      setDeletingLinkId(null);
    }
  };

  const handleSaveLink = async (formData: {
    label: string;
    url: string;
    description: string | null;
    emoji: string | null;
  }) => {
    try {
      setSavingLink(true);
      if (editingLink) {
        await apiPatch(
          `/burn/${project?.slug}/links/${editingLink.id}`,
          formData,
        );
      } else {
        await apiPost(`/burn/${project?.slug}/links`, formData);
      }
      await loadLinks();
      onModalClose();
      setEditingLink(null);
    } catch (error) {
      console.error("Failed to save link:", error);
    } finally {
      setSavingLink(false);
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, linkId: string) => {
    if (!editMode || !hasMembership) return;

    setDraggedLinkId(linkId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", e.currentTarget.innerHTML);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, linkId: string) => {
    if (!editMode || !hasMembership) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    // Calculate which side of the element we're hovering over
    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const mouseX = e.clientX;

    // In a grid layout, check if we're on the left or right side
    const position = mouseX < midX ? "before" : "after";

    setDragOverLinkId(linkId);
    setInsertPosition(position);
  };

  const handleDragLeave = () => {
    if (!editMode || !hasMembership) return;

    setDragOverLinkId(null);
    setInsertPosition("after");
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, dropTargetId: string) => {
    if (!editMode || !hasMembership) return;

    e.preventDefault();
    setDragOverLinkId(null);
    setInsertPosition("after");

    if (!draggedLinkId || draggedLinkId === dropTargetId) {
      return;
    }

    // Reorder links locally
    const draggedIndex = links.findIndex((link) => link.id === draggedLinkId);
    const targetIndex = links.findIndex((link) => link.id === dropTargetId);

    if (draggedIndex === -1 || targetIndex === -1) {
      return;
    }

    const newLinks = [...links];
    const [draggedLink] = newLinks.splice(draggedIndex, 1);

    // Calculate insertion index based on position
    // If we removed an item before the target, the target index shifts down by 1
    let insertIndex = targetIndex;
    if (draggedIndex < targetIndex) {
      insertIndex = targetIndex - 1;
    }

    // Adjust for before/after
    if (insertPosition === "after") {
      insertIndex += 1;
    }

    newLinks.splice(insertIndex, 0, draggedLink);

    // Update state optimistically
    setLinks(newLinks);

    // Send reorder request to backend
    try {
      setIsReordering(true);
      await apiPost(`/burn/${project?.slug}/links/reorder`, {
        linkIds: newLinks.map((link) => link.id),
      });
    } catch (error) {
      console.error("Failed to reorder links:", error);
      // Reload links on error to restore correct order
      await loadLinks();
    } finally {
      setIsReordering(false);
    }
  };

  const handleDragEnd = () => {
    if (!editMode || !hasMembership) return;

    setDraggedLinkId(null);
    setDragOverLinkId(null);
    setInsertPosition("after");
  };

  if (loading) {
    return (
      <>
        <Heading>Links</Heading>
        <div className="flex justify-center items-center py-8">
          <Spinner size="lg" />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <Heading>Links</Heading>
        {hasMembership && (
          <div className="flex gap-2">
            {!editMode ? (
              <Button
                startContent={<EditOutlined />}
                onPress={() => setEditMode(true)}
                color="primary"
              >
                Edit
              </Button>
            ) : (
              <Button onPress={() => setEditMode(false)} color="primary">
                Done
              </Button>
            )}
          </div>
        )}
      </div>

      {editMode && hasMembership && (
        <div className="mb-4 space-y-2">
          <Alert color="warning">
            All changes made here are public and visible to everyone.
          </Alert>
          <Alert color="primary">
            Drag and drop links to reorder them.
            {isReordering && <Spinner size="sm" className="ml-2" />}
          </Alert>
        </div>
      )}

      {links.length === 0 && !editMode && (
        <p className="text-gray-500">No links available yet.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {links.map((link) => (
          <div
            key={link.id}
            draggable={editMode && hasMembership}
            onDragStart={(e) => handleDragStart(e, link.id)}
            onDragOver={(e) => handleDragOver(e, link.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, link.id)}
            onDragEnd={handleDragEnd}
            className={`relative bg-white border rounded-lg shadow-sm p-4 transition-all ${
              editMode && hasMembership ? "cursor-move" : ""
            } ${
              draggedLinkId === link.id
                ? "opacity-50 border-gray-400"
                : dragOverLinkId === link.id
                  ? insertPosition === "before"
                    ? "border-l-4 border-l-blue-500 border-gray-200"
                    : "border-r-4 border-r-blue-500 border-gray-200"
                  : "border-gray-200 hover:shadow-md"
            }`}
          >
            {editMode && hasMembership && (
              <div className="absolute top-2 right-2 flex gap-1 z-10">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={() => handleEditLink(link)}
                  isDisabled={deletingLinkId !== null}
                >
                  <EditOutlined />
                </Button>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  color="danger"
                  onPress={() => handleDeleteLink(link.id)}
                  isLoading={deletingLinkId === link.id}
                  isDisabled={deletingLinkId !== null}
                >
                  <DeleteOutlined />
                </Button>
              </div>
            )}

            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`block ${editMode ? "pointer-events-none" : ""}`}
            >
              {link.emoji ? (
                <div className="text-2xl mb-2">{link.emoji}</div>
              ) : (
                <svg
                  className="w-6 h-6 mb-2 text-gray-700"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M18 14v4.833A1.166 1.166 0 0 1 16.833 20H5.167A1.167 1.167 0 0 1 4 18.833V7.167A1.166 1.166 0 0 1 5.167 6h4.618m4.447-2H20v5.768m-7.889 2.121 7.778-7.778"
                  />
                </svg>
              )}

              <h5 className="mb-1 text-lg font-semibold tracking-tight text-gray-900">
                {link.label}
              </h5>

              {link.description && (
                <p className="mb-2 text-sm text-gray-700">{link.description}</p>
              )}

              {!editMode && (
                <div className="inline-flex text-sm font-medium items-center text-blue-600 hover:underline">
                  Visit link
                  <svg
                    className="w-3 h-3 ms-2"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M18 14v4.833A1.166 1.166 0 0 1 16.833 20H5.167A1.167 1.167 0 0 1 4 18.833V7.167A1.166 1.166 0 0 1 5.167 6h4.618m4.447-2H20v5.768m-7.889 2.121 7.778-7.778"
                    />
                  </svg>
                </div>
              )}
            </a>
          </div>
        ))}
      </div>

      {editMode && hasMembership && (
        <Button
          startContent={<PlusOutlined />}
          onPress={handleAddLink}
          className="mt-4"
          color="primary"
        >
          Add Link
        </Button>
      )}

      <LinkModal
        isOpen={isModalOpen}
        onClose={() => {
          if (!savingLink) {
            onModalClose();
            setEditingLink(null);
          }
        }}
        onSave={handleSaveLink}
        link={editingLink}
        isSaving={savingLink}
      />
    </>
  );
}

function LinkModal({
  isOpen,
  onClose,
  onSave,
  link,
  isSaving,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    label: string;
    url: string;
    description: string | null;
    emoji: string | null;
  }) => void;
  link: BurnLink | null;
  isSaving: boolean;
}) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("");

  useEffect(() => {
    if (link) {
      setLabel(link.label);
      setUrl(link.url);
      setDescription(link.description || "");
      setEmoji(link.emoji || "");
    } else {
      setLabel("");
      setUrl("");
      setDescription("");
      setEmoji("");
    }
  }, [link, isOpen]);

  const handleSave = () => {
    if (!label.trim() || !url.trim()) {
      alert("Label and URL are required");
      return;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      alert("Please enter a valid URL (starting with http:// or https://)");
      return;
    }

    onSave({
      label: label.trim(),
      url: url.trim(),
      description: description.trim() || null,
      emoji: emoji.trim() || null,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSaving ? undefined : onClose}
      size="lg"
      isDismissable={!isSaving}
      hideCloseButton={isSaving}
    >
      <ModalContent>
        <ModalHeader>{link ? "Edit Link" : "Add New Link"}</ModalHeader>
        <ModalBody>
          <Input
            label="Label"
            placeholder="e.g., Talk Forum"
            value={label}
            onValueChange={setLabel}
            isRequired
            isDisabled={isSaving}
          />
          <Input
            label="URL"
            placeholder="https://example.com"
            value={url}
            onValueChange={setUrl}
            isRequired
            type="url"
            isDisabled={isSaving}
          />
          <Textarea
            label="Description (optional)"
            placeholder="Describe what this link is about..."
            value={description}
            onValueChange={setDescription}
            minRows={2}
            maxRows={4}
            isDisabled={isSaving}
          />
          <Input
            label="Emoji (optional)"
            placeholder="🎙️"
            value={emoji}
            onValueChange={setEmoji}
            description="A single emoji to display before the label"
            isDisabled={isSaving}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose} isDisabled={isSaving}>
            Cancel
          </Button>
          <Button color="primary" onPress={handleSave} isLoading={isSaving}>
            {link ? "Update" : "Add"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
