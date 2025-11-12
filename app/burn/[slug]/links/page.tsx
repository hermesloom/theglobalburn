"use client";

import React, { useState, useEffect } from "react";
import Heading from "@/app/_components/Heading";
import {
  Button,
  Input,
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
    emoji: string | null;
    display_order: number;
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
        <div className="mb-4">
          <Alert color="warning">
            All changes made here are public and visible to everyone.
          </Alert>
        </div>
      )}

      {links.length === 0 && !editMode && (
        <p className="text-gray-500">No links available yet.</p>
      )}

      <div className="flex flex-col gap-2">
        {links.map((link) => (
          <div key={link.id} className="flex items-center gap-2">
            <Button
              as="a"
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={
                editMode ? "flex-1 justify-start" : "justify-start w-auto"
              }
              variant={editMode ? "bordered" : "flat"}
              isDisabled={editMode}
            >
              {link.emoji && <span className="mr-2">{link.emoji}</span>}
              {link.label}
            </Button>
            {editMode && hasMembership && (
              <div className="flex gap-1">
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
        existingLinksCount={links.length}
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
  existingLinksCount,
  isSaving,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    label: string;
    url: string;
    emoji: string | null;
    display_order: number;
  }) => void;
  link: BurnLink | null;
  existingLinksCount: number;
  isSaving: boolean;
}) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [emoji, setEmoji] = useState("");
  const [displayOrder, setDisplayOrder] = useState(0);

  useEffect(() => {
    if (link) {
      setLabel(link.label);
      setUrl(link.url);
      setEmoji(link.emoji || "");
      setDisplayOrder(link.display_order);
    } else {
      setLabel("");
      setUrl("");
      setEmoji("");
      setDisplayOrder(existingLinksCount);
    }
  }, [link, existingLinksCount, isOpen]);

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
      emoji: emoji.trim() || null,
      display_order: displayOrder,
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
          <Input
            label="Emoji (optional)"
            placeholder="🎙️"
            value={emoji}
            onValueChange={setEmoji}
            description="A single emoji to display before the label"
            isDisabled={isSaving}
          />
          <Input
            label="Display Order"
            type="number"
            value={displayOrder.toString()}
            onValueChange={(value) => setDisplayOrder(parseInt(value) || 0)}
            description="Lower numbers appear first"
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
