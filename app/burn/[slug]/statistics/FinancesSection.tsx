"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@nextui-org/react";
import { useProject } from "@/app/_components/SessionContext";
import { apiGet } from "@/app/_components/api";
import { formatMoney } from "@/app/_components/utils";
import {
  ALVERSJO_VAT_RATE,
  FinancesPayload,
  SaleTotals,
} from "@/utils/stripe/types";
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
    { label: "Stripe fees", get: (t) => money(-t.stripeFees) },
    { label: "Chargebacks", get: (t) => money(-t.chargebacks) },
    { label: "Net kept", get: (t) => money(t.netKept), strong: true },
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

  const inv = data.alversjoInvoice;

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow mt-4">
      <h2 className="text-base sm:text-lg font-semibold mb-1">Finances</h2>
      <p className="text-xs sm:text-sm text-gray-500 mb-4">
        Taken directly from Stripe, for this burn only. Operating income is
        payments less refunds, before fees. Chargebacks are payments reversed by
        the cardholder&apos;s bank, including Stripe&apos;s fee for them.
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

      {data.carerMemberships > 0 && (
        <p className="text-xs text-gray-500 mt-2">
          Of the total, {data.carerMemberships} are free carer memberships for
          people supporting a person with a disability. They have no payment, so
          they appear only in the total.
        </p>
      )}

      <h3 className="text-sm font-semibold mt-6 mb-1">Alversjö invoice</h3>
      <p className="text-xs text-gray-500 mb-2">
        What Alversjö should invoice BL for the land memberships. Covers the
        spring memberships — the fall ones were already invoiced — and the Stripe
        fees from both sales, since fall&apos;s were never deducted.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b">
              <td className="py-1 pr-4">Landmedlemskap / Land memberships</td>
              <td className="py-1 px-4 text-right text-gray-500">
                {inv.quantity.toFixed(2)} × {money(inv.unitPriceExclVat)}
              </td>
              <td className="py-1 text-right">{money(inv.linesExclVat)}</td>
            </tr>
            <tr className="border-b">
              <td className="py-1 pr-4">Refunds on Alversjö memberships</td>
              <td className="py-1 px-4 text-right text-gray-500">
                −{inv.refundedUnits.toFixed(2)} × {money(inv.unitPriceExclVat)}
              </td>
              <td className="py-1 text-right">{money(-inv.refundExclVat)}</td>
            </tr>
            <tr className="border-b">
              <td className="py-1 pr-4">Banking (Stripe) fees</td>
              <td className="py-1 px-4 text-right text-gray-500">
                {money(inv.feesInclVat)} ÷ {1 + ALVERSJO_VAT_RATE}
              </td>
              <td className="py-1 text-right">{money(-inv.feesExclVat)}</td>
            </tr>
            <tr className="border-b">
              <td className="py-1 pr-4">Excl. VAT</td>
              <td />
              <td className="py-1 text-right">{money(inv.subtotalExclVat)}</td>
            </tr>
            <tr className="border-b">
              <td className="py-1 pr-4">VAT {ALVERSJO_VAT_RATE * 100}%</td>
              <td />
              <td className="py-1 text-right">{money(inv.vat)}</td>
            </tr>
            <tr className="font-semibold">
              <td className="py-1 pr-4">Total</td>
              <td />
              <td className="py-1 text-right">{money(inv.totalInclVat)}</td>
            </tr>
          </tbody>
        </table>
      </div>


      <div className={`text-xs mt-4 ${stale ? "text-red-500" : "text-gray-500"}`}>
        {data.lastSyncedAt
          ? `Last synchronized with Stripe: ${new Date(data.lastSyncedAt).toLocaleString()}`
          : "Never synchronized with Stripe — figures are empty until an admin runs a sync."}
      </div>
    </div>
  );
}
