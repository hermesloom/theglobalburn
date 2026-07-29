"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@nextui-org/react";
import { useProject } from "@/app/_components/SessionContext";
import { apiGet } from "@/app/_components/api";
import { formatMoney } from "@/app/_components/utils";
import { FinancesPayload, SaleTotals } from "@/utils/stripe/types";
import { stripeCurrenciesWithoutDecimals } from "@/app/api/_common/stripe";

export default function FinancesSection() {
  const { project } = useProject();
  const [data, setData] = useState<FinancesPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!project?.slug) return;
    apiGet(`/burn/${project.slug}/statistics/finances`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [project?.slug]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }
  if (!data) return null;

  // The API works in Stripe minor units; formatMoney expects display units.
  const factor = stripeCurrenciesWithoutDecimals.includes(
    data.currency.toUpperCase(),
  )
    ? 1
    : 100;
  const money = (minorUnits: number) =>
    formatMoney(minorUnits / factor, data.currency);

  const rows: {
    label: string;
    get: (t: SaleTotals) => string;
    strong?: boolean;
  }[] = [
    {
      label: "Membership income (excl. Alversjö)",
      get: (t) => money(t.membershipIncome),
    },
    { label: "Alversjö income", get: (t) => money(t.alversjoIncome) },
    {
      label: "Operating income (payments − refunds)",
      get: (t) => money(t.operatingIncome),
      strong: true,
    },
    { label: "Stripe fees", get: (t) => money(t.stripeFees) },
    { label: "Net kept", get: (t) => money(t.netKept) },
    { label: "Memberships", get: (t) => String(t.memberships) },
    {
      label: "Checked in",
      get: (t) =>
        t.memberships > 0
          ? `${t.checkedIn} (${Math.round((t.checkedIn / t.memberships) * 100)}%)`
          : String(t.checkedIn),
    },
    { label: "Payments", get: (t) => String(t.payments) },
    { label: "Refunds", get: (t) => String(t.refunds) },
    { label: "Membership transfers", get: (t) => String(t.transfers) },
    {
      label: "Surplus from transfers",
      get: (t) => money(t.transferSurplus),
    },
  ];

  const stale =
    !data.lastSyncedAt ||
    Date.now() - Date.parse(data.lastSyncedAt) > 24 * 60 * 60 * 1000;

  const r = data.reconciliation;

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow mt-4">
      <h2 className="text-base sm:text-lg font-semibold mb-1">Finances</h2>
      <p className="text-xs sm:text-sm text-gray-500 mb-4">
        Taken directly from Stripe. Gross and net are both shown: operating income
        is payments less refunds, before fees. Surplus from transfers is what the
        burn gained because memberships changed hands rather than the original
        holders keeping them — the retained transfer fee less the Stripe fee on the
        incoming payment, so it can be negative.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4 font-medium"> </th>
              <th className="py-2 px-4 font-medium text-right">Fall sale</th>
              <th className="py-2 px-4 font-medium text-right">Spring sale</th>
              <th className="py-2 pl-4 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b last:border-b-0">
                <td className={`py-2 pr-4 ${row.strong ? "font-semibold" : ""}`}>
                  {row.label}
                </td>
                <td
                  className={`py-2 px-4 text-right ${row.strong ? "font-semibold" : ""}`}
                >
                  {row.get(data.fall)}
                </td>
                <td
                  className={`py-2 px-4 text-right ${row.strong ? "font-semibold" : ""}`}
                >
                  {row.get(data.spring)}
                </td>
                <td
                  className={`py-2 pl-4 text-right ${row.strong ? "font-semibold" : ""}`}
                >
                  {row.get(data.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="text-sm font-semibold mt-6 mb-1">Reconciliation</h3>
      <p className="text-xs text-gray-500 mb-2">
        Why the sale rows do not equal the bank statement.
      </p>
      <table className="w-full text-sm">
        <tbody>
          <tr className="border-b">
            <td className="py-1 pr-4">Sale rows, net of fees</td>
            <td className="py-1 text-right">{money(r.saleRowsNet)}</td>
          </tr>
          <tr className="border-b">
            <td className="py-1 pr-4">
              Payments not belonging to this burn ({r.unattributedPayments.count}
              ), net
            </td>
            <td className="py-1 text-right">
              {money(r.unattributedPayments.net)}
            </td>
          </tr>
          <tr className="border-b">
            <td className="py-1 pr-4">
              Disputes ({r.disputes.count}), incl. {money(r.disputes.fees)} in fees
            </td>
            <td className="py-1 text-right">{money(r.disputes.amount)}</td>
          </tr>
          <tr className="border-b">
            <td className="py-1 pr-4">
              Other balance transactions ({r.otherBalanceTransactions.count})
            </td>
            <td className="py-1 text-right">
              {money(r.otherBalanceTransactions.amount)}
            </td>
          </tr>
          <tr className="border-b font-semibold">
            <td className="py-1 pr-4">Stripe balance movement (excl. payouts)</td>
            <td className="py-1 text-right">
              {money(r.balanceNetExcludingPayouts)}
            </td>
          </tr>
          <tr className="border-b">
            <td className="py-1 pr-4">Unexplained residual</td>
            <td
              className={`py-1 text-right ${r.residual !== 0 ? "text-red-500 font-semibold" : ""}`}
            >
              {money(r.residual)}
            </td>
          </tr>
          <tr>
            <td className="py-1 pr-4 text-gray-500">
              Paid out to bank ({r.payouts.count})
            </td>
            <td className="py-1 text-right text-gray-500">
              {money(r.payouts.amount)}
            </td>
          </tr>
          {r.unclassifiedMemberships > 0 && (
            <tr>
              <td className="py-1 pr-4 text-gray-500">
                Memberships with no matching payment, excluded from the counts
                above
              </td>
              <td className="py-1 text-right text-gray-500">
                {r.unclassifiedMemberships}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className={`text-xs mt-4 ${stale ? "text-red-500" : "text-gray-500"}`}>
        {data.lastSyncedAt
          ? `Last synchronized with Stripe: ${new Date(data.lastSyncedAt).toLocaleString()}`
          : "Never synchronized with Stripe — figures are empty until an admin runs a sync."}
      </div>
    </div>
  );
}
