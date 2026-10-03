"use client";

import { API_URL } from "@/lib/api";
import { useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";

type ReportData = {
  total_orders: number;
  total_revenue: string | number;
  orders_by_status: Record<string, number>;
  payments: {
    paid: number;
    unpaid: number;
  };
};

export default function DashboardPage() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadReport() {
      const token = localStorage.getItem("washease_token");

      if (!token) {
        setError("Authentication token not found.");
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/staff/reports`,
          {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(
            `Unable to load dashboard data (${response.status}).`
          );
        }

        const data = (await response.json()) as ReportData;

        setReport(data);
      } catch (error) {
        if (error instanceof Error) {
          setError(error.message);
        } else {
          setError("Unable to load dashboard data.");
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadReport();
  }, []);

  const readyForDelivery =
    report?.orders_by_status?.["Ready for Delivery"] ?? 0;

  const revenue = Number(report?.total_revenue ?? 0);

  return (
    <AdminShell title="Overview">
      <section>
        <div>
          <h2 className="text-xl font-bold text-[#17395d]">
            Overview
          </h2>

          <p className="mt-1 text-sm text-[#7892ad]">
            WashEase operations at a glance.
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total orders"
            value={isLoading ? "..." : String(report?.total_orders ?? 0)}
            icon="▣"
          />

          <MetricCard
            label="Ready for delivery"
            value={isLoading ? "..." : String(readyForDelivery)}
            icon="♧"
          />

          <MetricCard
            label="Pending payments"
            value={
              isLoading
                ? "..."
                : String(report?.payments?.unpaid ?? 0)
            }
            suffix="orders"
            icon="▤"
          />

          <MetricCard
            label="Total paid revenue"
            value={
              isLoading
                ? "..."
                : `₱${revenue.toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
            }
            icon="↗"
          />
        </div>

        <div className="mt-5 rounded-xl border border-[#dbe7f3] bg-white p-6">
          <h3 className="font-semibold text-[#17395d]">
            Live WashEase data
          </h3>

          <p className="mt-2 text-sm leading-6 text-[#7892ad]">
            These overview metrics are loaded from the WashEase
            Laravel API using the authenticated staff account.
          </p>
        </div>
      </section>
    </AdminShell>
  );
}

type MetricCardProps = {
  label: string;
  value: string;
  suffix?: string;
  icon: string;
};

function MetricCard({
  label,
  value,
  suffix,
  icon,
}: MetricCardProps) {
  return (
    <article className="min-h-[112px] rounded-xl border border-[#dbe7f3] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[#7892ad]">
            {label}
          </p>

          <div className="mt-4 flex items-baseline gap-2">
            <p className="text-2xl font-bold text-[#17395d]">
              {value}
            </p>

            {suffix && (
              <span className="text-xs text-[#8ba2b8]">
                {suffix}
              </span>
            )}
          </div>
        </div>

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#edf6ff] text-[#299cdb]">
          {icon}
        </div>
      </div>
    </article>
  );
}