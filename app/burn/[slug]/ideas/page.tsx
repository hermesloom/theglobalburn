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
  Textarea,
  Checkbox,
} from "@nextui-org/react";
import { useProject, useSession } from "@/app/_components/SessionContext";
import { apiGet, apiPost, apiDelete, apiPatch } from "@/app/_components/api";
import {
  DeleteOutlined,
  PlusOutlined,
  LikeOutlined,
  LikeFilled,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { BurnRole } from "@/utils/types";

interface BurnIdea {
  id: string;
  title: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  vote_count: number;
  user_has_voted: boolean;
  resolved: boolean;
}

export default function IdeasPage() {
  const { project } = useProject();
  const { profile } = useSession();
  const [ideas, setIdeas] = useState<BurnIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingIdeaId, setVotingIdeaId] = useState<string | null>(null);
  const [deletingIdeaId, setDeletingIdeaId] = useState<string | null>(null);
  const [editingIdea, setEditingIdea] = useState<BurnIdea | null>(null);
  const [savingIdea, setSavingIdea] = useState(false);
  const [resolvingIdeaId, setResolvingIdeaId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const {
    isOpen: isModalOpen,
    onOpen: onModalOpen,
    onClose: onModalClose,
  } = useDisclosure();

  const loadIdeas = async () => {
    try {
      setLoading(true);
      const url = `/burn/${project?.slug}/ideas${
        showResolved ? "?include_resolved=true" : ""
      }`;
      const response = await apiGet(url);
      setIdeas(response.data || []);
    } catch (error) {
      console.error("Failed to load ideas:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (project?.slug) {
      loadIdeas();
    }
  }, [project?.slug, showResolved]);

  const handleAddIdea = () => {
    setEditingIdea(null);
    onModalOpen();
  };

  const handleEditIdea = (idea: BurnIdea) => {
    setEditingIdea(idea);
    onModalOpen();
  };

  const handleDeleteIdea = async (ideaId: string) => {
    if (!confirm("Are you sure you want to delete this idea?")) {
      return;
    }
    try {
      setDeletingIdeaId(ideaId);
      await apiDelete(`/burn/${project?.slug}/ideas/${ideaId}`);
      await loadIdeas();
    } catch (error) {
      console.error("Failed to delete idea:", error);
    } finally {
      setDeletingIdeaId(null);
    }
  };

  const handleToggleVote = async (idea: BurnIdea) => {
    try {
      setVotingIdeaId(idea.id);
      if (idea.user_has_voted) {
        await apiDelete(`/burn/${project?.slug}/ideas/${idea.id}/vote`);
      } else {
        await apiPost(`/burn/${project?.slug}/ideas/${idea.id}/vote`);
      }
      await loadIdeas();
    } catch (error) {
      console.error("Failed to toggle vote:", error);
    } finally {
      setVotingIdeaId(null);
    }
  };

  const handleToggleResolved = async (idea: BurnIdea) => {
    try {
      setResolvingIdeaId(idea.id);
      await apiPatch(`/burn/${project?.slug}/ideas/${idea.id}/resolve`);
      await loadIdeas();
    } catch (error) {
      console.error("Failed to toggle resolved status:", error);
    } finally {
      setResolvingIdeaId(null);
    }
  };

  const canResolveIdeas = project?.roles.includes(BurnRole.IdeaResolver);

  const handleSaveIdea = async (formData: {
    title: string;
    description: string | null;
  }) => {
    try {
      setSavingIdea(true);
      if (editingIdea) {
        await apiPatch(
          `/burn/${project?.slug}/ideas/${editingIdea.id}`,
          formData,
        );
      } else {
        await apiPost(`/burn/${project?.slug}/ideas`, formData);
      }
      await loadIdeas();
      onModalClose();
      setEditingIdea(null);
    } catch (error) {
      console.error("Failed to save idea:", error);
    } finally {
      setSavingIdea(false);
    }
  };

  if (loading) {
    return (
      <>
        <Heading>Platform Feature Ideas</Heading>
        <div className="flex justify-center items-center py-8">
          <Spinner size="lg" />
        </div>
      </>
    );
  }

  const isOwnIdea = (idea: BurnIdea) => {
    return profile?.id === idea.owner_id;
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <Heading>Platform Feature Ideas</Heading>
        <Button
          startContent={<PlusOutlined />}
          onPress={handleAddIdea}
          color="primary"
        >
          Suggest
        </Button>
      </div>

      <p className="mb-4 text-default-600">
        This membership platform is designed to be flexible and adaptable. Share
        your ideas for features that could make this platform truly feel like a
        membership platform tailored to our community. What functionality would
        enhance your experience? The platform can be easily adjusted to support
        any use case, so no idea is too ambitious.
      </p>

      {canResolveIdeas && (
        <div className="mb-4">
          <Checkbox
            isSelected={showResolved}
            onValueChange={setShowResolved}
          >
            Show resolved ideas
          </Checkbox>
        </div>
      )}

      {ideas.length === 0 && (
        <p className="text-gray-500">
          {showResolved
            ? "No feature ideas found."
            : "No feature ideas yet. Be the first to suggest one!"}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {ideas.map((idea) => (
          <div
            key={idea.id}
            className={`border border-divider rounded-lg p-4 flex flex-col gap-2 ${
              idea.resolved
                ? "opacity-60 bg-default-50"
                : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3
                    className={`font-semibold text-lg ${
                      idea.resolved ? "line-through text-default-400" : ""
                    }`}
                  >
                    {idea.title}
                  </h3>
                  {idea.resolved && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-success-100 text-success-700">
                      Resolved
                    </span>
                  )}
                </div>
                {idea.description && (
                  <p
                    className={`text-sm whitespace-pre-wrap ${
                      idea.resolved ? "text-default-400" : "text-default-600"
                    }`}
                  >
                    {idea.description}
                  </p>
                )}
              </div>
              <div className="flex gap-1">
                {canResolveIdeas && (
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    color={idea.resolved ? "warning" : "success"}
                    onPress={() => handleToggleResolved(idea)}
                    isLoading={resolvingIdeaId === idea.id}
                    isDisabled={
                      deletingIdeaId !== null ||
                      votingIdeaId !== null ||
                      savingIdea ||
                      resolvingIdeaId !== null
                    }
                    title={idea.resolved ? "Mark as unresolved" : "Mark as resolved"}
                  >
                    {idea.resolved ? <CloseOutlined /> : <CheckOutlined />}
                  </Button>
                )}
                {isOwnIdea(idea) && (
                  <>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      onPress={() => handleEditIdea(idea)}
                      isDisabled={
                        deletingIdeaId !== null ||
                        votingIdeaId !== null ||
                        savingIdea ||
                        resolvingIdeaId !== null
                      }
                    >
                      <EditOutlined />
                    </Button>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      color="danger"
                      onPress={() => handleDeleteIdea(idea.id)}
                      isLoading={deletingIdeaId === idea.id}
                      isDisabled={
                        deletingIdeaId !== null ||
                        votingIdeaId !== null ||
                        savingIdea ||
                        resolvingIdeaId !== null
                      }
                    >
                      <DeleteOutlined />
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Button
                isIconOnly
                size="sm"
                variant={idea.user_has_voted ? "solid" : "bordered"}
                color={idea.user_has_voted ? "primary" : "default"}
                onPress={() => handleToggleVote(idea)}
                isLoading={votingIdeaId === idea.id}
                isDisabled={votingIdeaId !== null || deletingIdeaId !== null}
              >
                {idea.user_has_voted ? <LikeFilled /> : <LikeOutlined />}
              </Button>
              <span className="text-sm text-default-500">
                {idea.vote_count} vote{idea.vote_count !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        ))}
      </div>

      <IdeaModal
        isOpen={isModalOpen}
        onClose={() => {
          if (!savingIdea) {
            onModalClose();
            setEditingIdea(null);
          }
        }}
        onSave={handleSaveIdea}
        isSaving={savingIdea}
        idea={editingIdea}
      />
    </>
  );
}

function IdeaModal({
  isOpen,
  onClose,
  onSave,
  isSaving,
  idea,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { title: string; description: string | null }) => void;
  isSaving: boolean;
  idea: BurnIdea | null;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (idea) {
      setTitle(idea.title);
      setDescription(idea.description || "");
    } else {
      setTitle("");
      setDescription("");
    }
  }, [idea, isOpen]);

  const handleSave = () => {
    if (!title.trim()) {
      alert("Title is required");
      return;
    }

    onSave({
      title: title.trim(),
      description: description.trim() || null,
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
        <ModalHeader>
          {idea ? "Edit Platform Feature" : "Suggest a Platform Feature"}
        </ModalHeader>
        <ModalBody>
          <Input
            label="Feature Title"
            value={title}
            onValueChange={setTitle}
            isRequired
            isDisabled={isSaving}
          />
          <Textarea
            label="Description (optional)"
            placeholder="Describe the feature in detail. How would it work? What problem would it solve? How would it enhance the membership experience?"
            value={description}
            onValueChange={setDescription}
            isDisabled={isSaving}
            minRows={4}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose} isDisabled={isSaving}>
            Cancel
          </Button>
          <Button color="primary" onPress={handleSave} isLoading={isSaving}>
            {idea ? "Update" : "Add"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
