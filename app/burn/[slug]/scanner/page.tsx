"use client";

import React, { useState, useEffect } from "react";
import Heading from "@/app/_components/Heading";
import { Button, Card, CardBody } from "@nextui-org/react";
import { apiGet, ApiError } from "@/app/_components/api";

import QrScanner from 'qr-scanner';

let qrScanner: QrScanner,
  qrScannerEngine: any; // Using any since QrEngine type is not exported

interface Child {
  dob: string;
  key: string;
  last_name: string;
  first_name: string;
}

interface ScannedMember {
  id: string;
  first_name: string;
  last_name: string;
  birthdate: string;
  checked_in_at: string | null;
  metadata: {
    children: Child[];
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

const formatDOB = (dob: string) => {
  return new Date(dob).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const fetchQRData = (setScannedMember: React.Dispatch<React.SetStateAction<ScannedMember | null>>) => {
  console.log('00')
  return new Promise<string>((resolve, reject) => {
    console.log('01')
    const videoEl = document.getElementById('scanner-view') as HTMLVideoElement;
    console.log('02')
    if (!videoEl) return;
    console.log('03')

    console.log({ WORKER_PATH: QrScanner.WORKER_PATH })
    // if (!qrScannerEngine) {
    //   qrScannerEngine = QrScanner.createQrEngine(QrScanner.WORKER_PATH)
    // }
    console.log(11);

    if (!qrScanner) {
      qrScanner = new QrScanner(
        videoEl,
        (result: string) => {
          resolve(result);
          qrScanner.stop();
        },
        {
          returnDetailedScanResult: true,
          preferredCamera: 'environment',
          maxScansPerSecond: 15,
          highlightCodeOutline: true,
          qrEngine: qrScannerEngine
        }
      );
    }
    console.log(22);

    qrScanner.start().catch((e) => {
      console.log({ e })
      reject(`Could not start QR scanner. ERROR: ${e}`)
    });
  })
}

const clickAudio = new Audio('/sounds/click.mp3');
const dingAudio = new Audio('/sounds/ding.mp3');
const deniedAudio = new Audio('/sounds/denied.mp3');
// TODO: For banned members
const buzzAudio = new Audio('/sounds/buzz.mp3');

export default function ScannerPage() {
  const [scannedMember, setScannedMember] = useState<ScannedMember | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const startScan = () => {
    clickAudio.play();

    setScannedMember(null);
    setScanError(null);

    console.log('calling fetchQRData')
    fetchQRData(setScannedMember).then(async ({ data }) => {
      // TODO: Make project slug dynamic

      apiGet(`/burn/the-borderland-2025/admin/memberships/${data}`)
        .then((member) => {
          setScannedMember(member);

          if (member.checked_in_at) {
            // Should make a negative sound because the member has already been checked in
            deniedAudio.play();
            member.checked_in_at = new Date(member.checked_in_at).toISOString();
          } else {
            // Should make a positive sound because the member has not yet been checked in
            dingAudio.play();
          }
        })
        .catch((error) => {
          console.log({ message: error.message })
          deniedAudio.play();
          setScanError(error.message);
        })

    }).catch((error) => {
      setScanError(error);
    });
  };

  useEffect(() => {
    setScannedMember(null);
    //   startScan();
  }, []); // Empty dependency array means this runs once on mount

  return (
    <>
      <Heading>Membership scanner!</Heading>

      <div className="flex flex-col gap-4">
        <div className="relative w-full border border-black rounded-lg">

          <video
            className={`w-full h-full object-cover ${scannedMember || scanError ? 'hidden' : ''}`}
            id="scanner-view"
          ></video>

          {scannedMember && (
            <Card className={`w-full h-full ${scannedMember.checked_in_at == null ? 'bg-green-100' : 'bg-yellow-100'}`}>
              <CardBody className="flex flex-col justify-between">
                <div className="flex flex-col gap-2">
                  <p><strong>Name:</strong> {scannedMember.first_name} {scannedMember.last_name}</p>
                  <p><strong>Birthdate:</strong> {formatDOB(scannedMember.birthdate)}</p>
                  <p><strong>Checked in:</strong> {scannedMember.checked_in_at == null ? 'No' : formatRelativeDateTime(new Date(scannedMember.checked_in_at))}</p>

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

        {
          (<div className="w-full h-full flex items-center justify-center">
            <Button
              color="primary"
              onPress={startScan}
            >
              Scan QR
            </Button>
          </div>)
        }
      </div >
    </>
  );
}
