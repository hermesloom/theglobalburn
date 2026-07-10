"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button, Card, CardBody, Modal, ModalContent, ModalHeader, ModalBody, useDisclosure } from "@nextui-org/react";
import { apiPost } from "@/app/_components/api";
import { useSession, useProject } from "@/app/_components/SessionContext";
import { formatRelativeDateTime, calculateAge, isSameDay } from "@/app/burn/[slug]/membership/components/helpers/date";

import {
  CloseOutlined,
  QrcodeOutlined,
  BulbOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";

import QrScanner from 'qr-scanner';

interface Child {
  dob: string;
  key: string;
  last_name: string;
  first_name: string;
}

interface Pet {
  key: string;
  name: string;
  type: string;
  chip_code: string;
}

interface ScannedMember {
  id: string;
  first_name: string;
  last_name: string;
  birthdate: string;
  checked_in_at: string | null;
  metadata: {
    children: Child[];
    pets: Pet[];
  };
}


const clickAudio = new Audio('/sounds/click.mp3');
const dingAudio = new Audio('/sounds/ding.mp3');
const deniedAudio = new Audio('/sounds/denied.mp3');

function formatDOBJSX(dobString: string, highlightUnderage: boolean = false): JSX.Element {
  const dob = new Date(dobString);

  const description = dob.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const age = calculateAge(dob)

  const colorClass = (highlightUnderage && age < 18 ? "text-red-500 font-bold" : "")

  const birthdayString = (
    isSameDay(dob, new Date()) ?
      " 🎉 HAPPY BIRTHDAY! 🎉  - " :
      ""

  )

  return <>
    {description} - <span className="text-red-500">{birthdayString}</span> <span className={colorClass}>{age} years old</span>
  </>
}

export default function ScannerPage() {
  const { profile, refreshProfile } = useSession();
  const { project } = useProject();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  const [qrScanner, setQrScanner] = useState<QrScanner | null>(null);
  const [qrScannerHasFlash, setQrScannerHasFlash] = useState<boolean>(false);
  const [scannedMember, setScannedMember] = useState<ScannedMember | null>(null);
  const [resultMessage, setResultMessage] = useState<{ type: string, text: string } | null>(null);
  const [currentlyScanning, setCurrentlyScanning] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  const fetchQRData = () => {
    return new Promise<string>((resolve, reject) => {
      if (videoRef.current) {
        const scanner =
          new QrScanner(
            videoRef.current,
            async ({ data }) => {
              resolve(data);

              await cancelScan(scanner);
            },
            {
              preferredCamera: 'environment',
              maxScansPerSecond: 8,
              highlightScanRegion: true,
            }
          )

        setQrScanner(scanner);

        scanner?.start().then(async () => {
          setQrScannerHasFlash(await scanner?.hasFlash());
        })
          .catch((e) => {
            reject(`Could not start QR scanner. ERROR: ${e}`)
          });
      }
    })
  }

  const cancelScan = async (scanner: QrScanner) => {
    await scanner?.turnFlashOff()
    scanner?.stop();
    scanner?.destroy();
    setQrScanner(null);
    setCurrentlyScanning(false);
  }

  const startScan = () => {
    clickAudio.play();

    setQrScannerHasFlash(false);
    setQrScanner(null);
    setScannedMember(null);
    setResultMessage(null);
    setCurrentlyScanning(true);

    return fetchQRData().then((data) => {
      return apiPost(`/burn/${project!.slug}/admin/check-in-member/${data}`)
        .then((foundMember) => {
          setScannedMember(foundMember);

          refreshProfile();

          if (foundMember.checked_in_at) {
            // Should make a negative sound because the member has already been checked in
            deniedAudio.play();
            foundMember.checked_in_at = new Date(foundMember.checked_in_at).toISOString();
          } else {
            // Should make a positive sound because the member has not yet been checked in
            dingAudio.play();
          }
          setCurrentlyScanning(false);
        })
        .catch((error) => {
          setCurrentlyScanning(false);
          deniedAudio.play();
          const text = error.httpStatus === 404 ? "Member not found" : error.message;
          setResultMessage({ type: 'error', text });
        })
    }).catch((error) => {
      setResultMessage({ type: 'error', text: error });
    });
  };

  const undoCheckInMember = () => {
    if (scannedMember == null) {
      // **Shouldn't** happen, but just in case...
      setResultMessage({ type: 'error', text: "Attempted undo of member check-in when no member was scanned" });
    } else {
      return apiPost(`/burn/${project!.slug}/admin/undo-check-in-member/${scannedMember.id}`)
        .then(async (result) => {
          await refreshProfile();

          if (result.status === "DONE") {
            setScannedMember(null);
            setResultMessage({ type: 'notice', text: "Undo of check-in successful" });
          } else {
            // ERROR
            setScannedMember(null);
            setResultMessage({ type: 'error', text: "There was a problem undoing the check-in of the member!" });
          }
        })
        .catch(() => {
          setResultMessage({ type: 'error', text: "There was a error undoing check-in of the member!" });
        })
    }
  }

  const clearDisplay = () => {
    setScannedMember(null);
    setResultMessage(null);
    setCurrentlyScanning(false);
  }

  useEffect(() => {
    setScannedMember(null);
    setResultMessage(null);
    setCurrentlyScanning(false);

  }, []); // Empty dependency array means this runs once on mount

  return (
    <>
      <div className="mb-4 flex justify-between items-start w-full">
        <div className="flex items-center gap-1">
          <Button isIconOnly variant="light" onPress={onOpen} aria-label="Help">
            <QuestionCircleOutlined className="text-xl" />
          </Button>
          <span className="text-sm">Useful Info</span>
        </div>
        <div className="text-right">
          <p>Scanner ID: {profile?.metadata.scanner_id}</p>
          <p>Check-ins: {profile?.metadata.check_in_count || 0}</p>
        </div>
      </div>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="full" scrollBehavior="inside">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="text-2xl font-bold">Important Info</ModalHeader>
              <ModalBody className="pb-8">
                <div className="mt-4">
                  <Button color="primary" onPress={onClose}>Close</Button>
                </div>

                <p>For any questions about the below, contact the watcher via radio or phone at <a href="tel:+4672216381" className="text-blue-500 underline">+46 72 216 3831</a></p>
                <p><a href="https://docs.google.com/document/d/1cNYwpLhixDr5XQAVDMSrAtncT_8N49Q6NofBk8HTK9E/edit?tab=t.0" className="text-blue-500 underline" target="_blank">The full gatekeeper handbook</a></p>
                <p>Encourage people to refer to the QR code (available at the gate) for the membership platform and useful information.</p>

                <p className="font-bold">Gate opening hours: 9:00 - 22:00</p>

                <p>After Sun July 19 22:00 we only allow the following on site:</p>
                <ul className="list-disc pl-6">
                  <li>Registered members with wristbands</li>
                  <li>Registered cars with filled in vehicle cards for 1 hour</li>
                  <li>Registered sleeper vehicles with filled in vehicle cards to park and stay put. Gently ask about decoration of those.</li>
                  <li>For exceptions refer to <a href="https://docs.google.com/document/d/1cNYwpLhixDr5XQAVDMSrAtncT_8N49Q6NofBk8HTK9E/edit?tab=t.0" className="text-blue-500 underline" target="_blank">gatekeeper handbook</a> or contact Watcher.</li>
                </ul>

                <p className="font-bold">Check-in procedure:</p>
                <ol className="list-decimal pl-6 flex flex-col gap-2">
                  <li>Ask for a physical <strong>ID</strong> (official government ID, Passport, Driving License) - <strong>NO COPIES/PHOTOS OR DIGITAL IDs</strong></li>
                  <li>Ask for <strong>Membership QR</strong> code.</li>
                  <li>Check if name and date of birth on <strong>both match EXACTLY</strong>.</li>
                  <li>
                    <strong>If yes, scan QR</strong> code and confirm check-in.
                    <ol className="list-[lower-alpha] pl-6 mt-1 flex flex-col gap-1">
                      <li>Place wristband on wrist (with consent) - <strong>NO EXCEPTIONS</strong></li>
                      <li><strong>Check that it is secure</strong>, offer cutting and burning ends of wristband. If it is lost, we <strong>CAN NOT</strong> replace it.</li>

                      <li>
                        <p><strong>Children 0-13</strong> must be attached to a membership in the membership platform (you should see them when scanning the member's QR code)</p>
                        <p><strong>Children 14-17</strong> must have their OWN membership.</p>
                      </li>
                      <li>
                        <strong>Pets must be registered</strong> in the membership platform (you should see them when scanning the member's QR code).
                      </li>

                      <li>If they are responsible for a vehicle it must have a <strong>a Vehicle Card</strong>. Tell them to place it on dashboard visibly and be available on the phone at all times. There are two kinds of cards:</li>
                      <ul>
                        <li>If they are <strong>sleeping in their vehicle</strong> they should fill out information in the membership platform. They might have a card printed from the member platform or they can fill it out at the gate (but they still must put the information into the portal)</li>
                        <li>If they are <strong>not sleeping in their vehicle</strong> they can simply fill out the long-term parking form.</li>
                      </ul>
                    </ol>
                  </li>
                  <li><strong>If not, contact the Watcher</strong></li>
                </ol>

                <p className="font-bold">Important info for drivers:</p>
                <ol className="list-decimal pl-6 flex flex-col gap-1">
                  <li><strong>Speed limit 10km/h</strong></li>
                  <li>Vehicle <strong>registration card visible</strong> at all times, phone number on it reachable at all times</li>
                  <li>No driving during the event except emergencies.</li>
                  <li>No parking on roads.</li>
                  <li>Regular cars have <strong>1hr to unload</strong> and move to permanent parking.</li>
                  <li>Sleeper vehicles need <strong>registration</strong> in membership platform, should be <strong>decorated</strong>, parked with <strong>tow hitch facing fire road.</strong></li>
                </ol>

                <div className="mt-4">
                  <Button color="primary" onPress={onClose}>Close</Button>
                </div>
              </ModalBody>
            </>
          )}
        </ModalContent >
      </Modal >

      <div className="flex flex-col gap-4">
        <video
          className={`border border-black rounded-lg object-cover ${currentlyScanning ? '' : 'invisible absolute'}`}
          ref={videoRef}
        ></video>

        <div className="relative w-full">

          {scannedMember && (
            <Card className={`border border-black rounded-lg w-full h-full ${scannedMember.checked_in_at == null ? 'bg-green-100' : 'bg-red-300'}`}>
              <CardBody className="flex flex-col justify-between">
                <div className="flex flex-col gap-2">
                  {scannedMember.checked_in_at != null && <h2 className="text-2xl font-semibold mb-4">!!!ALREADY CHECKED IN!!!</h2>}
                  <p><strong>Name:</strong> {scannedMember.first_name} {scannedMember.last_name}</p>
                  <p><strong>Birthdate:</strong> {formatDOBJSX(scannedMember.birthdate, true)}</p>
                  <p><strong>Checked in:</strong> {scannedMember.checked_in_at == null ? 'Just now' : formatRelativeDateTime(new Date(scannedMember.checked_in_at))}</p>

                  {scannedMember.metadata?.children?.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-semibold mb-2">Children</h4>
                      <div className="flex flex-col gap-2">
                        {scannedMember.metadata.children.map((child) => (
                          <div key={child.key} className="pl-4 border-l-2 border-gray-200">
                            <p><strong>Name:</strong> {child.first_name} {child.last_name}</p>
                            <p><strong>Birthdate:</strong> {formatDOBJSX(child.dob)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {scannedMember.metadata?.pets?.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-semibold mb-2">Pets</h4>
                      <div className="flex flex-col gap-2">
                        {scannedMember.metadata.pets.map((pet) => (
                          <div key={pet.key} className="pl-4 border-l-2 border-gray-200">
                            <p><strong>Name:</strong> {pet.name}</p>
                            <p><strong>Type:</strong> {pet.type}</p>
                            <p><strong>Chip Code:</strong> {pet.chip_code}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          )}

          {resultMessage && (
            <Card className={`w-full h-full ${resultMessage.type === 'error' ? 'bg-orange-100' : 'bg-green-100'}`}>
              <CardBody className="flex flex-col justify-between">
                <div className="flex flex-col gap-2 text-center">
                  {resultMessage.text}
                </div>
              </CardBody>
            </Card>
          )}
        </div>

        {(qrScannerHasFlash && false) && (
          <div className="w-full h-full flex items-center justify-center">
            <Button
              color="primary"
              size="lg"
              onPress={qrScanner?.toggleFlash}
            >
              <BulbOutlined />
              Toggle Flashlight
            </Button>
          </div>
        )}

        {currentlyScanning &&
          (<div className="w-full h-full flex items-center justify-center">
            <Button
              color="primary"
              size="lg"
              onPress={() => { if (qrScanner) { cancelScan(qrScanner) } }}
            >
              <CloseOutlined />
              Cancel
            </Button>
          </div>
          )}

        {!currentlyScanning && !scannedMember &&
          <div className="w-full h-full flex items-center justify-center">
            <Button
              color="primary"
              size="lg"
              onPress={startScan}
            >
              <QrcodeOutlined />
              Scan QR Code
            </Button>
          </div>}

        {(scannedMember || resultMessage) &&
          (<div className="w-full h-full flex items-center justify-center">
            <Button
              color="success"
              size="lg"
              className="px-8 py-4 text-6xl min-h-20 min-w-80"
              onPress={clearDisplay}
            >
              Done
            </Button>
          </div>)}

        {!currentlyScanning && scannedMember && scannedMember.checked_in_at == null &&
          <div className="mt-12 w-full h-full flex items-center justify-center">
            <Button
              color="danger"
              size="sm"
              onPress={() => {
                if (confirm("Are you sure you want to undo the member's check-in?")) {
                  undoCheckInMember()
                }
              }}
            >
              Undo
            </Button>
          </div>}

      </div >
    </>
  );
}
