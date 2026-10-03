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
  const [reports, setReports] = useState<Reports | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadReports() {
      const token = localStorage.getItem("washease_token");

      if (!token) {
        setError("Authentication token not found.");
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/staff/reports`, {
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
        setError(
          error instanceof Error ? error.message : "Unable to load reports."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadReports();
  }, []);

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
                label="Paid Revenue"
                value={`₱${Number(reports.total_revenue).toFixed(2)}`}
              />

              <SummaryCard
                label="Paid"
                value={reports.payments?.paid ?? 0}
              />

              <SummaryCard
                label="Unpaid"
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