"use client";

import { useEffect, useState } from "react";
import { useProject } from "@/app/_components/SessionContext";
import { apiGet } from "@/app/_components/api";
import { Spinner } from "@nextui-org/react";
import Heading from "@/app/_components/Heading";
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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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
      <>
        <Heading>Statistics</Heading>
        <div className="flex justify-center items-center py-8">
          <Spinner size="lg" />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Heading>Statistics</Heading>
        <div className="text-red-500">Error: {error}</div>
      </>
    );
  }

  if (!statistics) {
    return (
      <>
        <Heading>Statistics</Heading>
        <div>No statistics available</div>
      </>
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
    {
      name: isMobile ? "Low" : "Low Income",
      fullName: "Low Income",
      count: statistics.lowIncome,
    },
    {
      name: isMobile ? "Medium" : "Medium Income",
      fullName: "Medium Income",
      count: statistics.mediumIncome,
    },
    {
      name: isMobile ? "High" : "High Income",
      fullName: "High Income",
      count: statistics.highIncome,
    },
  ];

  const pieData = incomeData.filter((item) => item.value > 0);

  return (
    <>
      <Heading>Statistics</Heading>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4">
        {/* Bar Chart */}
        <div className="bg-white p-3 sm:p-4 md:p-6 rounded-lg shadow">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
            Memberships by Income Tier
          </h2>
          <ResponsiveContainer width="100%" height={isMobile ? 250 : 350}>
            <BarChart
              data={chartData}
              margin={{
                top: 5,
                right: 10,
                left: 0,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                angle={isMobile ? 0 : -45}
                textAnchor={isMobile ? "middle" : "end"}
                height={isMobile ? 40 : 60}
                tick={{ fontSize: isMobile ? 11 : 12 }}
                interval={0}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  fontSize: "14px",
                  padding: "8px",
                  borderRadius: "6px",
                }}
                formatter={(value: any, name: any, props: any) => [
                  value,
                  props.payload.fullName || name,
                ]}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar dataKey="count" fill="#8884d8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="bg-white p-3 sm:p-4 md:p-6 rounded-lg shadow">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
            Income Distribution
          </h2>
          <ResponsiveContainer width="100%" height={isMobile ? 250 : 350}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent, value }) => {
                  // Show label only if value > 0 and percent is significant
                  if (value === 0 || !name) return "";
                  const percentage = (percent! * 100).toFixed(0);
                  // On mobile, show shorter labels
                  const shortName = isMobile ? name.split(" ")[0] : name;
                  return `${shortName}: ${percentage}%`;
                }}
                outerRadius={isMobile ? 60 : 80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  fontSize: "14px",
                  padding: "8px",
                  borderRadius: "6px",
                }}
                formatter={(value: any, name: any) => [
                  `${value} (${((value / statistics.total) * 100).toFixed(1)}%)`,
                  name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
          <div className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">
            Low Income
          </div>
          <div
            className="text-xl sm:text-2xl md:text-3xl font-bold"
            style={{ color: COLORS.lowIncome }}
          >
            {statistics.lowIncome}
          </div>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
          <div className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">
            Medium Income
          </div>
          <div
            className="text-xl sm:text-2xl md:text-3xl font-bold"
            style={{ color: COLORS.mediumIncome }}
          >
            {statistics.mediumIncome}
          </div>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
          <div className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">
            High Income
          </div>
          <div
            className="text-xl sm:text-2xl md:text-3xl font-bold"
            style={{ color: COLORS.highIncome }}
          >
            {statistics.highIncome}
          </div>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
          <div className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-2">
            Alversjö
          </div>
          <div
            className="text-xl sm:text-2xl md:text-3xl font-bold"
            style={{ color: COLORS.alversjo }}
          >
            {statistics.alversjo}
          </div>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
        <div className="text-sm sm:text-base text-gray-600 mb-2">
          Total Memberships
        </div>
        <div className="text-2xl sm:text-3xl md:text-4xl font-bold">
          {statistics.total}
        </div>
      </div>
    </>
  );
}
