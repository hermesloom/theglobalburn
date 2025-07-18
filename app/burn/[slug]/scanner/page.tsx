"use client";

import React, { useState, useEffect, useRef } from "react";
import Heading from "@/app/_components/Heading";
import { Button, Card, CardBody } from "@nextui-org/react";
import { apiPost, ApiError } from "@/app/_components/api";
import { useSession, useProject } from "@/app/_components/SessionContext";
import { formatRelativeDateTime, calculateAge, isSameDay } from "@/app/burn/[slug]/membership/components/helpers/date";

import {
  CloseOutlined,
  CheckOutlined,
  QrcodeOutlined,
  ReloadOutlined,
  BulbOutlined,
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
  let dob = new Date(dobString);

  let description = dob.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let age = calculateAge(dob)

  let colorClass = (highlightUnderage && age < 18 ? "text-red-500 font-bold" : "")

  let birthdayString = (
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

  const [qrScanner, setQrScanner] = useState<QrScanner | null>(null);
  const [qrScannerHasFlash, setQrScannerHasFlash] = useState<boolean>(false);
  const [scannedMember, setScannedMember] = useState<ScannedMember | null>(null);
  const [resultMessage, setResultMessage] = useState<{type: string, text: string} | null>(null);
  const [currentlyScanning, setCurrentlyScanning] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  const fetchQRData = () => {
    return new Promise<string>((resolve, reject) => {
      if (videoRef.current) {
        let scanner =
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
          setResultMessage({type: 'error', text: error.message});
        })
    }).catch((error) => {
      setResultMessage({type: 'error', text: error});
    });
  };

  const undoCheckInMember = () => {
    if (scannedMember == null) {
      // **Shouldn't** happen, but just in case...
      setResultMessage({type: 'error', text: "Attempted undo of member check-in when no member was scanned"});
    } else {
      return apiPost(`/burn/${project!.slug}/admin/undo-check-in-member/${scannedMember.id}`)
      .then(async (result) => {
        await refreshProfile();

        if (result.status === "DONE") {
          setScannedMember(null);
          setResultMessage({type: 'notice', text: "Undo of check-in successful"});
        } else {
          // ERROR
          setScannedMember(null);
          setResultMessage({type: 'error', text: "There was a problem undoing the check-in of the member!"});
        }
      })
      .catch((error) => {
        setResultMessage({type: 'error', text: "There was a error undoing check-in of the member!"});
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
      <div className="mb-4 text-right w-full">
        <p>Scanner ID: {profile?.metadata.scanner_id}</p>
        <p>Check-ins: {profile?.metadata.check_in_count || 0}</p>
      </div>

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
              onPress={() => { if(qrScanner) { cancelScan(qrScanner) } }}
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
