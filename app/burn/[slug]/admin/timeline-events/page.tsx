"use client";

import React, { useState, useEffect } from "react";
import Heading from "@/app/_components/Heading";
import { Button, Input, Textarea, Card, CardBody, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@nextui-org/react";
import { useProject } from "@/app/_components/SessionContext";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/app/_components/api";
import { BurnTimelineEvent } from "@/utils/types";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function TimelineEventsAdminPage() {
  const { project } = useProject();
  const [events, setEvents] = useState<BurnTimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingEvent, setEditingEvent] = useState<BurnTimelineEvent | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [date, setDate] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      const response = await apiGet(`/burn/${project?.slug}/admin/timeline-events`);
      setEvents(response.data);
    } catch (error) {
      toast.error("Failed to load timeline events");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (project?.slug) {
      fetchEvents();
    }
  }, [project?.slug]);

  const handleOpenCreateModal = () => {
    setEditingEvent(null);
    setTitle("");
    setBody("");
    setDate("");
    setDateEnd("");
    onOpen();
  };

  const handleOpenEditModal = (event: BurnTimelineEvent) => {
    setEditingEvent(event);
    setTitle(event.title);
    setBody(event.body || "");
    setDate(event.date ? new Date(event.date).toISOString().slice(0, 16) : "");
    setDateEnd(event.date_end ? new Date(event.date_end).toISOString().slice(0, 16) : "");
    onOpen();
  };

  const handleSave = async () => {
    try {
      if (!title.trim()) {
        toast.error("Title is required");
        return;
      }

      const eventData = {
        title: title.trim(),
        body: body.trim() || undefined,
        date: date || undefined,
        date_end: dateEnd || undefined,
      };

      if (editingEvent) {
        // Update existing event
        await apiPatch(
          `/burn/${project?.slug}/admin/timeline-events/${editingEvent.id}`,
          eventData
        );
        toast.success("Timeline event updated");
      } else {
        // Create new event
        await apiPost(`/burn/${project?.slug}/admin/timeline-events`, eventData);
        toast.success("Timeline event created");
      }

      onClose();
      fetchEvents();
    } catch (error) {
      toast.error(editingEvent ? "Failed to update event" : "Failed to create event");
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm("Are you sure you want to delete this timeline event?")) {
      return;
    }

    try {
      await apiDelete(`/burn/${project?.slug}/admin/timeline-events/${eventId}`);
      toast.success("Timeline event deleted");
      fetchEvents();
    } catch (error) {
      toast.error("Failed to delete event");
    }
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return "Not set";
    return new Date(dateString).toLocaleString();
  };

  return (
    <>
      <Heading>{project?.name} – Manage Timeline Events</Heading>

      <div className="mt-6">
        <Button color="primary" onPress={handleOpenCreateModal}>
          Add New Timeline Event
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-6 text-center">Loading timeline events...</div>
      ) : events.length === 0 ? (
        <div className="mt-6 text-center text-default-500">
          No timeline events yet. Create your first one!
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {events.map((event) => (
            <Card key={event.id} shadow="sm">
              <CardBody>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{event.title}</h3>
                    <div className="text-small text-default-500 mt-1">
                      <div>Start: {formatDateTime(event.date)}</div>
                      {event.date_end && <div>End: {formatDateTime(event.date_end)}</div>}
                    </div>
                    {event.body && (
                      <div className="mt-2 prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {event.body}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      size="sm"
                      color="primary"
                      variant="flat"
                      onPress={() => handleOpenEditModal(event)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      color="danger"
                      variant="flat"
                      onPress={() => handleDelete(event.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={isOpen} onClose={onClose} size="3xl" scrollBehavior="inside">
        <ModalContent key={editingEvent?.id || 'new'}>
          <ModalHeader>
            {editingEvent ? "Edit Timeline Event" : "Create Timeline Event"}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input
                label="Title"
                placeholder="Event title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                isRequired
              />

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-small">Body (Markdown)</label>
                  <Button
                    size="sm"
                    variant="light"
                    onPress={() => setShowMarkdownPreview(!showMarkdownPreview)}
                  >
                    {showMarkdownPreview ? "Hide Preview" : "Show Preview"}
                  </Button>
                </div>
                <Textarea
                  placeholder="Event description in Markdown format"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  minRows={6}
                />
                {showMarkdownPreview && body && (
                  <div className="mt-2 p-4 border rounded-lg prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {body}
                    </ReactMarkdown>
                  </div>
                )}
              </div>

              <Input
                key={`start-${editingEvent?.id || 'new'}`}
                label="Start Date/Time"
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                description="Leave empty for TBD"
              />

              <Input
                key={`end-${editingEvent?.id || 'new'}`}
                label="End Date/Time (Optional)"
                type="datetime-local"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                description="For events spanning multiple days"
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>
              Cancel
            </Button>
            <Button color="primary" onPress={handleSave}>
              {editingEvent ? "Update" : "Create"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
