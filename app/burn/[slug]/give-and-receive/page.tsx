"use client";

import React, { useState } from "react";
import { useProject } from "@/app/_components/SessionContext";
import Heading from "@/app/_components/Heading";
import { apiDelete, apiGet, apiPost } from "@/app/_components/api";
import { GiveAndReceiveDesire, GiveAndReceiveOffer } from "@/utils/types";
import BasicTable from "@/app/_components/BasicTable";
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@nextui-org/react";
import { usePrompt } from "@/app/_components/PromptContext";
import toast from "react-hot-toast";
import Link from "next/link";

interface Match {
  id: string;
  text_content: string;
  created_at: string;
  user: {
    email: string;
    first_name: string;
    last_name: string;
  };
}

export default function GiveAndReceivePage() {
  const { project } = useProject();
  const prompt = usePrompt();
  const [matchesModalVisible, setMatchesModalVisible] = useState(false);
  const [currentMatches, setCurrentMatches] = useState<Match[]>([]);
  const [complementaryText, setComplementaryText] = useState("");
  const [matchType, setMatchType] = useState<"offer" | "desire">("offer");
  const [isLoading, setIsLoading] = useState({
    addOffer: false,
    addDesire: false,
    deleteOffer: false,
    deleteDesire: false,
    findMatches: false,
  });

  // Get offers and desires from the project
  const offers = project?.giveAndReceive?.offers || [];
  const desires = project?.giveAndReceive?.desires || [];

  // Column definitions for the tables
  const offerColumns = [
    {
      key: "text_content",
      label: "What I want to give",
      render: (text: string) =>
        text.length > 100 ? `${text.substring(0, 100)}...` : text,
    },
  ];

  const desireColumns = [
    {
      key: "text_content",
      label: "What I want to receive",
      render: (text: string) =>
        text.length > 100 ? `${text.substring(0, 100)}...` : text,
    },
  ];

  // Update the deletion handlers to delete immediately without confirmation
  const handleDeleteOffer = async (offer: GiveAndReceiveOffer) => {
    setIsLoading({ ...isLoading, deleteOffer: true });

    try {
      await apiDelete(
        `/burn/${project!.slug}/give-and-receive/offer/${offer.id}`,
      );
      toast.success("Offer deleted successfully!");
      window.location.reload();
    } catch (error) {
      toast.error("Failed to delete offer");
    } finally {
      setIsLoading({ ...isLoading, deleteOffer: false });
    }
  };

  const handleDeleteDesire = async (desire: GiveAndReceiveDesire) => {
    setIsLoading({ ...isLoading, deleteDesire: true });

    try {
      await apiDelete(
        `/burn/${project!.slug}/give-and-receive/desire/${desire.id}`,
      );
      toast.success("Desire deleted successfully!");
      window.location.reload();
    } catch (error) {
      toast.error("Failed to delete desire");
    } finally {
      setIsLoading({ ...isLoading, deleteDesire: false });
    }
  };

  // Update handlers to use loading states
  const handleAddOffer = async () => {
    setIsLoading({ ...isLoading, addOffer: true });

    const data = await prompt("What would you like to offer?", [
      {
        key: "text_content",
        label: "Describe what you want to give or share with others",
        type: "text",
      },
    ]);

    if (data) {
      try {
        const result = await apiPost(
          `/burn/${project!.slug}/give-and-receive/offer`,
          data,
        );
        toast.success("Offer added successfully!");
        findMatches("offer", result.id);
      } catch (error) {
        toast.error("Failed to add offer");
      }
    }

    setIsLoading({ ...isLoading, addOffer: false });
  };

  const handleAddDesire = async () => {
    setIsLoading({ ...isLoading, addDesire: true });

    const data = await prompt("What would you like to receive?", [
      {
        key: "text_content",
        label: "Describe what you're looking for or need from others",
        type: "text",
      },
    ]);

    if (data) {
      try {
        const result = await apiPost(
          `/burn/${project!.slug}/give-and-receive/desire`,
          data,
        );
        toast.success("Desire added successfully!");
        findMatches("desire", result.id);
      } catch (error) {
        toast.error("Failed to add desire");
      }
    }

    setIsLoading({ ...isLoading, addDesire: false });
  };

  // Find matches for an offer or desire
  const findMatches = async (type: "offer" | "desire", id: string) => {
    try {
      const result = await apiGet(
        `/burn/${project!.slug}/give-and-receive/${type}/${id}/matches`,
      );

      setMatchType(type);
      setCurrentMatches(result.matches);
      setComplementaryText(
        type === "offer"
          ? result.complementary_desire
          : result.complementary_offer,
      );
      setMatchesModalVisible(true);
    } catch (error) {
      toast.error(`Failed to find matches for your ${type}`);
    }
  };

  // Check if the user has an active membership
  const hasMembership = !!project?.membership;

  // Add a refresh function that doesn't reload the page
  const refreshData = async () => {
    // This would ideally update the projects/giveAndReceive data without a full page reload
    // For now, we'll use the simple reload method
    window.location.reload();
  };

  if (!hasMembership) {
    return (
      <div className="p-4">
        <Heading>Give and Receive</Heading>
        <p>You need an active membership to use this feature.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <Heading>Give and Receive</Heading>
      <div className="flex flex-col gap-4 mb-8">
        <p>
          The following section allows you to ask for something or to express
          that you are providing something. It can be pretty much anything.
        </p>
        <p>
          Only people with an active membership have access to this tool. When
          matches are found, you will be able to see the names and email
          addresses of these matches and other matches will be able to see
          yours. When you submit offers or desires below, you agree that other
          membership holders might be able to see your name and email address.
          If you don't want that, please do not use this tool.
        </p>
        <p>
          When you use this tool, the text of your offer or desire will be sent
          to OpenAI for processing as well as Pinecone for storage. If you don't
          want that, please do not use this tool. None of your personally
          identifiable data will be shared with these services. For more
          technical details, please see the{" "}
          <Link
            href="https://github.com/hermesloom/theglobalburn/tree/main/app/burn/%5Bslug%5D/give-and-receive/README.md"
            className="underline"
            target="_blank"
          >
            README
          </Link>{" "}
          file.
        </p>
      </div>

      <div className="mb-12">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">What I Want to Give</h3>
          <Button
            color="primary"
            onClick={handleAddOffer}
            isLoading={isLoading.addOffer}
          >
            Add Offer
          </Button>
        </div>

        {offers.length > 0 ? (
          <BasicTable
            data={offers}
            columns={offerColumns}
            rowsPerPage={10}
            ariaLabel="My Offers"
            rowActions={[
              {
                key: "findMatches",
                icon: <span className="material-icons">search</span>,
                label: "Find Matches",
                onClick: (data) =>
                  findMatches("offer", (data as GiveAndReceiveOffer).id),
              },
              {
                key: "delete",
                icon: <span className="material-icons">delete</span>,
                label: "Delete",
                onClick: (data) =>
                  handleDeleteOffer(data as GiveAndReceiveOffer),
              },
            ]}
          />
        ) : (
          <p className="text-gray-500 italic mt-4">
            You haven't added any offers yet.
          </p>
        )}
      </div>

      <div className="mb-12">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">What I Want to Receive</h3>
          <Button
            color="primary"
            onClick={handleAddDesire}
            isLoading={isLoading.addDesire}
          >
            Add Request
          </Button>
        </div>

        {desires.length > 0 ? (
          <BasicTable
            data={desires}
            columns={desireColumns}
            rowsPerPage={10}
            ariaLabel="My Desires"
            rowActions={[
              {
                key: "findMatches",
                icon: <span className="material-icons">search</span>,
                label: "Find Matches",
                onClick: (data) =>
                  findMatches("desire", (data as GiveAndReceiveDesire).id),
              },
              {
                key: "delete",
                icon: <span className="material-icons">delete</span>,
                label: "Delete",
                onClick: (data) =>
                  handleDeleteDesire(data as GiveAndReceiveDesire),
              },
            ]}
          />
        ) : (
          <p className="text-gray-500 italic mt-4">
            You haven't added any requests yet.
          </p>
        )}
      </div>

      {/* Matches Modal */}
      <Modal
        isOpen={matchesModalVisible}
        onClose={() => setMatchesModalVisible(false)}
        size="4xl"
      >
        <ModalContent>
          <ModalHeader>
            {matchType === "offer"
              ? "People Who Need What You Offer"
              : "People Who Can Provide What You Need"}
          </ModalHeader>
          <ModalBody>
            <div className="mb-4">
              <h5 className="font-bold">
                AI-generated complementary{" "}
                {matchType === "offer" ? "request" : "offer"}:
              </h5>
              <div className="p-3 bg-gray-100 rounded mb-6">
                {complementaryText}
              </div>

              <h5 className="font-bold">Matches:</h5>
              {currentMatches.length > 0 ? (
                <Table aria-label="Matches table">
                  <TableHeader>
                    <TableColumn>USER</TableColumn>
                    <TableColumn>EMAIL</TableColumn>
                    <TableColumn>
                      {matchType === "offer"
                        ? "WHAT THEY NEED"
                        : "WHAT THEY OFFER"}
                    </TableColumn>
                    <TableColumn>POSTED</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {currentMatches.map((match) => (
                      <TableRow key={match.id}>
                        <TableCell>{`${match.user.first_name} ${match.user.last_name}`}</TableCell>
                        <TableCell>{match.user.email}</TableCell>
                        <TableCell>{match.text_content}</TableCell>
                        <TableCell>
                          {new Date(match.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p>
                  No matches found. Try adding more detail to your {matchType}{" "}
                  to find better matches.
                </p>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              color="primary"
              onClick={() => setMatchesModalVisible(false)}
            >
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
