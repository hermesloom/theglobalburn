"use client";

import React, { useState, useEffect, useRef } from "react";
import Heading from "@/app/_components/Heading";
import { Button, Card, CardBody } from "@nextui-org/react";
import { apiPost, ApiError } from "@/app/_components/api";
import { useSession, useProject } from "@/app/_components/SessionContext";

import {
  QrcodeOutlined,
  ReloadOutlined,
} from "@ant-design/icons";

import QrScanner from 'qr-scanner';

let qrScanner: QrScanner | null,
  qrScannerEngine: any; // Using any since QrEngine type is not exported

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

const formatRelativeDateTime = (date: Date) => {
  const now = new Date();

  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let relativeDay;

  if (diffDays === 0 && now.getDate() === date.getDate()) {
    relativeDay = 'Today'
  } else if (diffDays <= 1 && now.getDate() - date.getDate() === 1) {
    relativeDay = 'Yesterday';
  } else if (diffDays < 7) {
    relativeDay = `${diffDays === 1 ? "1 day" : `${diffDays} days`} ago`;
  }

  let weekday = date.toLocaleDateString('en-US', { weekday: 'long' });

  return `${weekday} at ${timeString} (${relativeDay})`;
}

const calculateAge = (birthDate: Date) => {
  let currentDate = new Date();

  let age = currentDate.getFullYear() - birthDate.getFullYear();

  // Check if the birthday has occurred yet this year
  const hasHadBirthdayThisYear =
    currentDate.getMonth() > birthDate.getMonth() ||
    (currentDate.getMonth() === birthDate.getMonth() &&
      currentDate.getDate() >= birthDate.getDate());

  if (!hasHadBirthdayThisYear) {
    age--;
  }

  return age;
}

function isSameDay(date1: Date, date2: Date) {
  return (
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}


const formatDOB = (dobString: string, highlightUnderage: boolean = false) => {
  let dob = new Date(dobString);

  let age = calculateAge(dob)

  let description = dob.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

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

const clickAudio = new Audio('/sounds/click.mp3');
const dingAudio = new Audio('/sounds/ding.mp3');
const deniedAudio = new Audio('/sounds/denied.mp3');
// TODO: For banned members
const buzzAudio = new Audio('/sounds/buzz.mp3');

export default function ScannerPage() {
  const { profile, refreshProfile } = useSession();
  const { project } = useProject();

  const [scannedMember, setScannedMember] = useState<ScannedMember | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [currentlyScanning, setCurrentlyScanning] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  const fetchQRData = () => {
    return new Promise<string>((resolve, reject) => {
      if (videoRef.current) {
        qrScanner = new QrScanner(
          videoRef.current,
          ({ data }) => {
            resolve(data);
            qrScanner.turnFlashOff().then(() => {
              qrScanner?.stop();
              qrScanner?.destroy();
              qrScanner = null;
            })
          },
          {
            preferredCamera: 'environment',
            maxScansPerSecond: 8,
            // qrEngine: qrScannerEngine
          }
        );

        qrScanner.start().then(async (e) => {
          if (await qrScanner.hasFlash()) {
            await qrScanner.turnFlashOn();
          }
        }).catch((e) => {
          reject(`Could not start QR scanner. ERROR: ${e}`)
        });
      }
    })
  }

  const startScan = () => {
    clickAudio.play();

    setScannedMember(null);
    setScanError(null);
    setCurrentlyScanning(true);

    fetchQRData().then((data) => {
      apiPost(`/burn/${project!.slug}/admin/check-in-member/${data}`)
        .then((foundMember) => {
          setScannedMember(foundMember);
          setCurrentlyScanning(false);

          refreshProfile();

          if (foundMember.checked_in_at) {
            // Should make a negative sound because the member has already been checked in
            deniedAudio.play();
            foundMember.checked_in_at = new Date(foundMember.checked_in_at).toISOString();
          } else {
            // Should make a positive sound because the member has not yet been checked in
            dingAudio.play();
          }
        })
        .catch((error) => {
          setCurrentlyScanning(false);
          deniedAudio.play();
          setScanError(error.message);
        })
    }).catch((error) => {
      setScanError(error);
    });
  };

  const clearDisplay = () => {
    setScannedMember(null);
    setScanError(null);
    setCurrentlyScanning(false);
  }

  useEffect(() => {
    setScannedMember(null);
    setScanError(null);
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
            <Card className={`border border-black rounded-lg w-full h-full ${scannedMember.checked_in_at == null ? 'bg-green-100' : 'bg-yellow-100'}`}>
              <CardBody className="flex flex-col justify-between">
                <div className="flex flex-col gap-2">
                  <p><strong>Name:</strong> {scannedMember.first_name} {scannedMember.last_name}</p>
                  <p><strong>Birthdate:</strong> {formatDOB(scannedMember.birthdate, true)}</p>
                  <p><strong>Checked in:</strong> {scannedMember.checked_in_at == null ? 'Just now' : formatRelativeDateTime(new Date(scannedMember.checked_in_at))}</p>

                  {scannedMember.metadata?.children?.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-semibold mb-2">Children</h4>
                      <div className="flex flex-col gap-2">
                        {scannedMember.metadata.children.map((child) => (
                          <div key={child.key} className="pl-4 border-l-2 border-gray-200">
                            <p><strong>Name:</strong> {child.first_name} {child.last_name}</p>
                            <p><strong>Birthdate:</strong> {formatDOB(child.dob)}</p>
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

          {scanError && (
            <Card className="w-full h-full bg-orange-100">
              <CardBody className="flex flex-col justify-between">
                <div className="flex flex-col gap-2 text-center">
                  {scanError}
                </div>
              </CardBody>
            </Card>
          )}
        </div>

        <div className="w-full h-full flex items-center justify-center">
          <Button
            color="primary"
            size="lg"
            onPress={startScan}
          >
            <QrcodeOutlined />
            Scan QR Code
          </Button>
        </div>

        {(scannedMember || scanError) &&
        (<div className="w-full h-full flex items-center justify-center">
          <Button
            color="secondary"
            size="lg"
            onPress={clearDisplay}
          >
            <ReloadOutlined />
            Clear Display
          </Button>
        </div>)}
      </div >
    </>
  );
}
