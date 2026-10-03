"use client";

import { API_URL } from "@/lib/api";
import { useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";

type Reports = {
  total_orders: number;
  total_revenue: string | number;
  orders_by_status: Record<string, number>;
  payments: {
    paid: number;
    unpaid: number;
  };
};

export default function ReportsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [period, setPeriod] = useState({ from: "", to: "" });
  const [reports, setReports] = useState<Reports | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadReports() {
      setIsLoading(true); setError("");
      const token = localStorage.getItem("washease_token");

      if (!token) {
        setError("Authentication token not found.");
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/staff/reports${period.from ? `?from=${period.from}&to=${period.to}` : ""}`, {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(
            `Unable to load reports (${response.status}).`
          );
        }

        const data = await response.json();
        setReports(data);
      } catch (error) {
        if (controller.signal.aborted) return;
        setError(
          error instanceof Error ? error.message : "Unable to load reports."
        );
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    loadReports();
    return () => controller.abort();
  }, [period]);

  const statusEntries = reports
    ? Object.entries(reports.orders_by_status ?? {})
    : [];

  return (
    <AdminShell title="Reports">
      <div className="mx-auto max-w-7xl space-y-6">
        <p className="text-sm text-[#6f89a3]">
          Operational summary generated from WashEase order and payment
          records.
        </p>

        <form onSubmit={e => { e.preventDefault(); if (!from || !to || from > to) { setError("Choose a start and end date; end date must be on or after start date."); return; } setPeriod({ from, to }); }} className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4"><label className="text-sm">From<input type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-1 block rounded-lg border p-2" /></label><label className="text-sm">To<input type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-1 block rounded-lg border p-2" /></label><button disabled={isLoading} className="rounded-lg bg-[#17395d] px-4 py-2 text-white">Apply dates</button><button type="button" disabled={isLoading} onClick={() => { setFrom(""); setTo(""); setPeriod({ from: "", to: "" }); }} className="rounded-lg border px-4 py-2">All time</button></form>
        <p className="text-sm text-slate-600">{period.from ? `${period.from} to ${period.to}` : "All time"} · Philippine time. Order counts use booking date and current status. Collected revenue uses payment date, so it can include orders booked earlier.</p>
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="rounded-2xl border border-[#dbe7f3] bg-white p-5 text-sm text-[#7892ad]">
            Loading reports...
          </div>
        ) : reports ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                label="Total Orders"
                value={reports.total_orders}
              />

              <SummaryCard
                label="Collected revenue"
                value={`₱${Number(reports.total_revenue).toFixed(2)}`}
              />

              <SummaryCard
                label="Booked orders currently paid"
                value={reports.payments?.paid ?? 0}
              />

              <SummaryCard
                label="Booked orders currently unpaid"
                value={reports.payments?.unpaid ?? 0}
              />
            </section>

            <section className="overflow-hidden rounded-2xl border border-[#dbe7f3] bg-white">
              <div className="border-b border-[#e3edf6] px-5 py-4">
                <h2 className="font-semibold text-[#17395d]">
                  Orders by Status
                </h2>

                <p className="mt-1 text-xs text-[#8098ae]">
                  Current distribution of orders across the service workflow.
                </p>
              </div>

              {statusEntries.length === 0 ? (
                <p className="p-5 text-sm text-[#7892ad]">
                  No order statistics available.
                </p>
              ) : (
                <div className="divide-y divide-[#edf3f8]">
                  {statusEntries.map(([status, total]) => (
                    <div
                      key={status}
                      className="flex items-center justify-between px-5 py-4"
                    >
                      <span className="text-sm text-[#4f7192]">
                        {status}
                      </span>

                      <span className="rounded-full bg-[#e8f3fc] px-3 py-1 text-sm font-semibold text-[#28618e]">
                        {total}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <div className="rounded-2xl border border-[#dbe7f3] bg-white p-5 text-sm text-[#7892ad]">
            No report data available.
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-[#dbe7f3] bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-[#8ba2b8]">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold text-[#17395d]">
        {value}
      </p>
    </div>
  );
}