"use client";

import Link from "next/link";
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
  const [attention, setAttention] = useState<{ id: number; order_number: string; reason: string }[]>([]);
  const [revision, setRevision] = useState(0);
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadReport() {
      setIsLoading(true); setError("");
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

        const orderResponse = await fetch(`${API_URL}/staff/orders`, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });
        if (!orderResponse.ok) throw new Error("Unable to load the work queue. Retry to refresh dashboard data.");
        const orderData: { id: number; order_number: string; status: string; weight: string | null; payment_status: string; delivery_run_id: number | null; address: { delivery_zone: { is_active: boolean } | null } | null }[] = await orderResponse.json();
        setAttention(orderData.flatMap(order => {
          const reasons: string[] = [];
          if (order.status === "Pending") reasons.push("Booking awaiting confirmation");
          if (["Picked Up", "Processing", "Ready for Delivery"].includes(order.status) && Number(order.weight || 0) <= 0) reasons.push("Laundry weight missing");
          if (order.status === "Ready for Delivery" && !order.address?.delivery_zone?.is_active) reasons.push("Active delivery zone needed");
          if (order.status === "Ready for Delivery" && !order.delivery_run_id) reasons.push("Delivery rider not assigned");
          if (order.status === "Delivered" && order.payment_status === "Unpaid") reasons.push("Delivered order awaiting payment");
          return reasons.length ? [{ id: order.id, order_number: order.order_number, reason: reasons.join(" · ") }] : [];
        }));
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
  }, [revision]);

  const readyForDelivery =
    report?.orders_by_status?.["Ready for Delivery"] ?? 0;

  const revenue = Number(report?.total_revenue ?? 0);

  return (
    <AdminShell title="Overview">
      <section>
        <div>
          <h2 className="text-xl font-bold text-[#17395d]">
            Work needing attention
          </h2>

          <p className="mt-1 text-sm text-[#7892ad]">
            Open an order to resolve its next action. Summary totals below cover all time.
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}<button onClick={() => setRevision(value => value + 1)} className="ml-3 font-semibold underline">Retry</button>
          </div>
        )}

        <section className="mt-5 rounded-xl border border-[#dbe7f3] bg-white p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Order work queue {isLoading ? "" : `· ${attention.length}`}</h3><button disabled={isLoading} onClick={() => setRevision(value => value + 1)} className="rounded-lg border px-3 py-2 text-sm">{isLoading ? "Refreshing..." : "Refresh"}</button></div>{isLoading ? <p className="mt-4 text-sm">Loading work queue...</p> : error ? <p className="mt-4 text-sm">Queue unavailable. Retry above.</p> : !attention.length ? <p className="mt-4 text-sm text-slate-600">No orders need attention under these checks. Review Deliveries for active trips and rider returns.</p> : <div className="mt-4 divide-y">{attention.map(item => <Link key={item.id} href={`/orders?order=${item.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-slate-50"><div><strong className="text-sm">{item.order_number}</strong><p className="mt-1 text-sm text-slate-600">{item.reason}</p></div><span className="text-sm font-semibold">Open order →</span></Link>)}</div>}</section>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="All-time orders"
            value={(isLoading || error) ? "—" : String(report?.total_orders ?? 0)}
            icon="▣"
          />

          <MetricCard
            label="Ready for delivery"
            value={(isLoading || error) ? "—" : String(readyForDelivery)}
            icon="♧"
          />

          <MetricCard
            label="Pending payments"
            value={
              (isLoading || error)
                ? "—"
                : String(report?.payments?.unpaid ?? 0)
            }
            suffix="orders"
            icon="▤"
          />

          <MetricCard
            label="All-time collected revenue"
            value={
              (isLoading || error)
                ? "—"
                : `₱${revenue.toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`
            }
            icon="↗"
          />
        </div>

        <section className="mt-6 rounded-xl border border-[#dbe7f3] bg-white p-5">
          <h3 className="font-semibold text-[#17395d]">Continue the daily workflow</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              { href: "/orders", title: "Manage laundry orders", detail: "Confirm bookings, weigh laundry, and update processing progress." },
              { href: "/deliveries", title: "Plan and track deliveries", detail: `${readyForDelivery} orders ready for delivery. Schedule orders, assign riders, and confirm return.` },
              { href: "/payments", title: "Review unpaid orders", detail: `${report?.payments?.unpaid ?? 0} unpaid orders. Check collection records before recording payment.` },
            ].map(action => <Link key={action.href} href={action.href} className="rounded-xl border border-[#dbe7f3] p-4 transition hover:border-[#17395d] hover:bg-slate-50"><p className="font-semibold">{action.title} →</p><p className="mt-2 text-sm leading-6 text-slate-600">{action.detail}</p></Link>)}
          </div>
        </section>
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