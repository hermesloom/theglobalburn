"use client";

import { useEffect, useState } from "react";
import { useProject } from "@/app/_components/SessionContext";
import { apiGet } from "@/app/_components/api";
import { Spinner } from "@nextui-org/react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Statistics {
  lowIncome: number;
  mediumIncome: number;
  highIncome: number;
  alversjo: number;
  total: number;
}

const COLORS = {
  lowIncome: "#8884d8",
  mediumIncome: "#82ca9d",
  highIncome: "#ffc658",
  alversjo: "#ff7300",
};

export default function StatisticsPage() {
  const { project } = useProject();
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        setLoading(true);
        const data = await apiGet(`/burn/${project?.slug}/statistics`);
        setStatistics(data);
        setError(null);
      } catch (err: any) {
        setError(err.message || "Failed to load statistics");
      } finally {
        setLoading(false);
      }
    };

    if (project?.slug) {
      fetchStatistics();
    }
  }, [project?.slug]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  if (!statistics) {
    return (
      <div className="p-4">
        <div>No statistics available</div>
      </div>
    );
  }

  const incomeData = [
    {
      name: "Low Income",
      value: statistics.lowIncome,
      color: COLORS.lowIncome,
    },
    {
      name: "Medium Income",
      value: statistics.mediumIncome,
      color: COLORS.mediumIncome,
    },
    {
      name: "High Income",
      value: statistics.highIncome,
      color: COLORS.highIncome,
    },
  ];

  const chartData = [
    { name: "Low Income", count: statistics.lowIncome },
    { name: "Medium Income", count: statistics.mediumIncome },
    { name: "High Income", count: statistics.highIncome },
  ];

  const pieData = incomeData.filter((item) => item.value > 0);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Membership Statistics</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">
            Memberships by Income Tier
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Income Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name}: ${(percent! * 100).toFixed(0)}%`
                }
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Low Income</div>
          <div
            className="text-2xl font-bold"
            style={{ color: COLORS.lowIncome }}
          >
            {statistics.lowIncome}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Medium Income</div>
          <div
            className="text-2xl font-bold"
            style={{ color: COLORS.mediumIncome }}
          >
            {statistics.mediumIncome}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">High Income</div>
          <div
            className="text-2xl font-bold"
            style={{ color: COLORS.highIncome }}
          >
            {statistics.highIncome}
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Alversjö Memberships</div>
          <div
            className="text-2xl font-bold"
            style={{ color: COLORS.alversjo }}
          >
            {statistics.alversjo}
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <div className="text-sm text-gray-600">Total Memberships</div>
        <div className="text-3xl font-bold">{statistics.total}</div>
      </div>
    </div>
  );
}
