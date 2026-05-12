"use client";

import { useEffect, useState } from "react";
import { useProject } from "@/app/_components/SessionContext";
import { apiGet } from "@/app/_components/api";
import { Spinner } from "@nextui-org/react";
import Heading from "@/app/_components/Heading";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface AgeEntry {
  age: number;
  count: number;
}

interface YoungMember {
  id: string;
  first_name: string;
  last_name: string;
  birthdate: string;
  age: number;
}

interface OldChild {
  member: { id: string; first_name: string; last_name: string };
  child: { first_name: string; last_name: string; dob: string; age: number };
}

interface WatcherStatistics {
  memberCount: number;
  childrenCount: number;
  memberAgeDistribution: AgeEntry[];
  childrenAgeDistribution: AgeEntry[];
  petCounts: { dogs: number; cats: number; other: number };
  anomalies: {
    youngMembers: YoungMember[];
    oldChildren: OldChild[];
  };
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="text-sm text-gray-600 mb-2">{label}</div>
      <div
        className="text-3xl font-bold"
        style={color ? { color } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function AgeChart({ data, title }: { data: AgeEntry[]; title: string }) {
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      {data.length === 0 ? (
        <div className="text-gray-500">No data</div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={data}
            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="age"
              label={{ value: "Age", position: "insideBottom", offset: -2 }}
              height={40}
              tick={{ fontSize: 11 }}
            />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip formatter={(value) => [value, "Count"]} />
            <Bar dataKey="count" fill="#8884d8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function WatcherStatisticsPage() {
  const { project } = useProject();
  const [stats, setStats] = useState<WatcherStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!project?.slug) return;
    setLoading(true);
    apiGet(`/burn/${project.slug}/admin/watcher-statistics`)
      .then((data) => {
        setStats(data);
        setError(null);
      })
      .catch((err: any) => setError(err.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, [project?.slug]);

  if (loading) {
    return (
      <>
        <Heading>Watcher Statistics</Heading>
        <div className="flex justify-center items-center py-8">
          <Spinner size="lg" />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Heading>Watcher Statistics</Heading>
        <div className="text-red-500">Error: {error}</div>
      </>
    );
  }

  if (!stats) return null;

  return (
    <>
      <Heading>Watcher Statistics</Heading>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Members" value={stats.memberCount} color="#8884d8" />
        <StatCard label="Children" value={stats.childrenCount} color="#82ca9d" />
        <StatCard label="Dogs" value={stats.petCounts.dogs} color="#ffc658" />
        <StatCard label="Cats" value={stats.petCounts.cats} color="#ff7300" />
        <StatCard label="Other Pets" value={stats.petCounts.other} color="#a4a4a4" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <AgeChart
          data={stats.memberAgeDistribution}
          title="Member Age Distribution"
        />
        <AgeChart
          data={stats.childrenAgeDistribution}
          title="Children Age Distribution"
        />
      </div>

      <h2 className="text-xl font-bold mb-4">Anomalies</h2>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-1">
          Members aged 13 or younger
        </h3>
        <p className="text-sm text-gray-500 mb-3">
          Members must be at least 14 years old.
        </p>
        {stats.anomalies.youngMembers.length === 0 ? (
          <div className="text-gray-500 italic">None</div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-2 border">Name</th>
                <th className="p-2 border">Date of Birth</th>
                <th className="p-2 border">Age</th>
              </tr>
            </thead>
            <tbody>
              {stats.anomalies.youngMembers.map((m) => (
                <tr key={m.id} className="border-b">
                  <td className="p-2 border">{m.first_name} {m.last_name}</td>
                  <td className="p-2 border">{m.birthdate}</td>
                  <td className="p-2 border">{m.age}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-1">
          Children aged 14 or older
        </h3>
        <p className="text-sm text-gray-500 mb-3">
          Anyone 14 or older requires their own membership and should not be
          listed as a child of another member.
        </p>
        {stats.anomalies.oldChildren.length === 0 ? (
          <div className="text-gray-500 italic">None</div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-2 border">Member</th>
                <th className="p-2 border">Child Name</th>
                <th className="p-2 border">Child DOB</th>
                <th className="p-2 border">Child Age</th>
              </tr>
            </thead>
            <tbody>
              {stats.anomalies.oldChildren.map((entry, i) => (
                <tr key={i} className="border-b">
                  <td className="p-2 border">
                    {entry.member.first_name} {entry.member.last_name}
                  </td>
                  <td className="p-2 border">
                    {entry.child.first_name} {entry.child.last_name}
                  </td>
                  <td className="p-2 border">{entry.child.dob}</td>
                  <td className="p-2 border">{entry.child.age}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
