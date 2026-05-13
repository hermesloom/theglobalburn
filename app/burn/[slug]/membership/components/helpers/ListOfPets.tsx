import React, { useRef, useState } from "react";
import Heading from "@/app/_components/Heading";
import ActionButton from "@/app/_components/ActionButton";
import BasicTable from "@/app/_components/BasicTable";
import { v4 as uuidv4 } from "uuid";
import { apiPatch } from "@/app/_components/api";
import { useProject } from "@/app/_components/SessionContext";
import { DeleteOutlined, UploadOutlined } from "@ant-design/icons";
import { createClient } from "@/utils/supabase/client";
import toast from "react-hot-toast";
import {
  Button,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@nextui-org/react";
import Dropdown from "@/app/_components/Dropdown";

export interface Pet {
  key: string;
  firstName: string;
  lastName: string;
  dob: string;
  photo_url?: string;
}

const PET_TYPES = ["Dog", "Cat", "Other"];

export default function ListOfPets({ data }: { data: Pet[] }) {
  const [pets, setPets] = useState(data);
  const { project } = useProject();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    type: "",
    chip_code: "",
    description: "",
    other_information: "",
  });
  const [addPhotoFile, setAddPhotoFile] = useState<File | null>(null);
  const [addPhotoPreview, setAddPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const addFileInputRef = useRef<HTMLInputElement | null>(null);

  const openAddModal = () => {
    setAddForm({ name: "", type: "", chip_code: "", description: "", other_information: "" });
    setAddPhotoFile(null);
    setAddPhotoPreview(null);
    setAddModalOpen(true);
  };

  const handleAddPhotoSelect = (file: File) => {
    setAddPhotoFile(file);
    setAddPhotoPreview(URL.createObjectURL(file));
  };

  const handleAddSubmit = async () => {
    if (!addForm.name || !addForm.type) return;
    setIsSubmitting(true);
    try {
      const petKey = uuidv4();
      let photo_url: string | undefined;

      if (addPhotoFile) {
        const supabase = createClient();
        const membershipId = project?.membership?.id;
        if (supabase && membershipId) {
          const ext = addPhotoFile.name.split(".").pop();
          const path = `${membershipId}/${petKey}.${ext}`;
          const { error } = await supabase.storage
            .from("pet-photos")
            .upload(path, addPhotoFile, { upsert: true });
          if (!error) {
            const { data: urlData } = supabase.storage
              .from("pet-photos")
              .getPublicUrl(path);
            photo_url = `${urlData.publicUrl}?t=${Date.now()}`;
          } else {
            toast.error("Failed to upload photo");
          }
        }
      }

      const newPets = [...pets, { key: petKey, ...addForm, ...(photo_url ? { photo_url } : {}) }];
      await apiPatch(`/burn/${project!.slug}/pets`, { pets: newPets });
      setPets(newPets);
      setAddModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhotoUpload = async (petKey: string, file: File) => {
    const supabase = createClient();
    if (!supabase) return;
    const membershipId = project?.membership?.id;
    if (!membershipId) return;
    const ext = file.name.split(".").pop();
    const path = `${membershipId}/${petKey}.${ext}`;
    const { error } = await supabase.storage
      .from("pet-photos")
      .upload(path, file, { upsert: true });
    if (error) {
      toast.error("Failed to upload photo");
      return;
    }
    const { data: urlData } = supabase.storage
      .from("pet-photos")
      .getPublicUrl(path);
    const photo_url = `${urlData.publicUrl}?t=${Date.now()}`;
    const newPets = pets.map((p) =>
      p.key === petKey ? { ...p, photo_url } : p
    );
    await apiPatch(`/burn/${project!.slug}/pets`, { pets: newPets });
    setPets(newPets);
  };

  const columns = [
    {
      key: "photo_url",
      label: "Photo",
      render: (_: any, item: any) => {
        const pet = item as Pet;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {pet.photo_url && (
              <img
                src={pet.photo_url}
                alt="pet"
                style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 4 }}
              />
            )}
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              ref={(el) => { fileInputRefs.current[pet.key] = el; }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePhotoUpload(pet.key, file);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInputRefs.current[pet.key]?.click()}
              style={{ cursor: "pointer", background: "none", border: "none", padding: 0 }}
              title="Upload photo"
            >
              <UploadOutlined />
            </button>
          </div>
        );
      },
    },
    {
      key: "name",
      label: "Name",
    },
    {
      key: "type",
      label: "Type",
    },
    {
      key: "chip_code",
      label: "Chip Code"
    },
    {
      key: "description",
      label: "Pet Description",
    },
    {
      key: "other_information",
      label: "Other Information",
    },
  ];

  const updatePets = async (newPets: Pet[]) => {
    await apiPatch(`/burn/${project!.slug}/pets`, {
      pets: newPets,
    });
    setPets(newPets);
  };

  return (
    <>
      <Heading className="mt-12">Accompanying pets</Heading>
      {pets?.length > 0 ? (
        <BasicTable
          data={pets}
          columns={columns}
          rowsPerPage={10}
          ariaLabel={`pets`}
          noPagination
          rowActions={[
            {
              key: "delete",
              icon: <DeleteOutlined />,
              onClick: async (data) => {
                await updatePets(
                  pets.filter((pet) => pet.key !== (data as Pet).key),
                );
              },
            },
          ]}
        />
      ) : null}
      <ActionButton
        style={pets?.length > 0 ? { marginTop: "0.5rem" } : {}}
        action={{
          key: "addPet",
          label: "Add pet",
          onClick: { handler: async () => openAddModal() },
        }}
      />

      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} placement="top">
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="px-10 pt-10">Add a pet</ModalHeader>
              <ModalBody className="px-10">
                <div className="space-y-4">
                  <Input
                    label="Name"
                    value={addForm.name}
                    onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  />
                  <div>
                    <div className="block text-small font-medium text-foreground pb-1.5">Type</div>
                    <Dropdown
                      options={PET_TYPES.map((t) => ({ id: t, label: t }))}
                      value={addForm.type}
                      onChange={(v) => setAddForm((f) => ({ ...f, type: v }))}
                    />
                  </div>
                  <Input
                    label="Chip Code"
                    value={addForm.chip_code}
                    onChange={(e) => setAddForm((f) => ({ ...f, chip_code: e.target.value }))}
                  />
                  <Input
                    label="Pet Description"
                    value={addForm.description}
                    onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                  />
                  <Input
                    label="Other Information"
                    value={addForm.other_information}
                    onChange={(e) => setAddForm((f) => ({ ...f, other_information: e.target.value }))}
                  />
                  <div>
                    <div className="block text-small font-medium text-foreground pb-1.5">Photo (optional)</div>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      ref={addFileInputRef}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAddPhotoSelect(file);
                        e.target.value = "";
                      }}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      {addPhotoPreview && (
                        <img
                          src={addPhotoPreview}
                          alt="preview"
                          style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6 }}
                        />
                      )}
                      <Button
                        variant="flat"
                        onPress={() => addFileInputRef.current?.click()}
                        startContent={<UploadOutlined />}
                      >
                        {addPhotoPreview ? "Change photo" : "Upload photo"}
                      </Button>
                    </div>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button
                  color="primary"
                  fullWidth
                  isDisabled={!addForm.name || !addForm.type}
                  isLoading={isSubmitting}
                  onPress={handleAddSubmit}
                >
                  Add pet
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}

