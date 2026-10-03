"use client";

import { API_URL } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";

type Customer = {
  id: number;
  name: string;
  email: string | null;
};

type Order = {
  id: number;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  payment_preference: string | null;
  total_amount: string | number | null;
  paid_at: string | null;
  user: Customer | null;
};

export default function PaymentsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [collecting, setCollecting] = useState<Order | null>(null);
  const [method, setMethod] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOrders() {
      const token = localStorage.getItem("washease_token");

      if (!token) {
        setError("Authentication token not found.");
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/staff/orders`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(
            `Unable to load payment records (${response.status}).`
          );
        }

        const data = await response.json();
        setOrders(Array.isArray(data) ? data : []);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Unable to load payment records."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadOrders();
  }, []);

  async function recordCollection() {
    if (!collecting) return;
    if (!method) { setError("Choose the method actually collected: Cash or GCash."); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`${API_URL}/staff/orders/${collecting.id}/payment`, { method: "PUT", headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("washease_token")}` }, body: JSON.stringify({ payment_status: "Paid", payment_method: method }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to record collection.");
      setOrders(items => items.map(item => item.id === collecting.id ? { ...item, ...data.order } : item));
      setSuccess(`Collection recorded for ${collecting.order_number} via ${method}.`); setCollecting(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to record collection."); } finally { setSaving(false); }
  }

  const paidOrders = orders.filter(
    (order) => order.payment_status === "Paid"
  );

  const unpaidOrders = orders.filter(
    (order) => order.payment_status === "Unpaid"
  );

  const paidRevenue = paidOrders.reduce(
    (sum, order) => sum + Number(order.total_amount ?? 0),
    0
  );

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesFilter =
        filter === "All" || order.payment_status === filter;

      const matchesSearch =
        !query ||
        order.order_number.toLowerCase().includes(query) ||
        (order.user?.name ?? "").toLowerCase().includes(query) ||
        (order.payment_method ?? "").toLowerCase().includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [orders, search, filter]);

  return (
    <AdminShell title="Payments">
      <div className="mx-auto max-w-7xl space-y-6">
        <p className="text-sm text-[#6f89a3]">
          Review payment status, payment methods, and recorded revenue.
          Record a collection only after confirming the money was received.
        </p>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && <p role="status" className="rounded-lg bg-emerald-50 p-4 text-emerald-800">{success}</p>}
        {collecting && <section id="collection-form" className="scroll-mt-24 rounded-xl border border-[#17395d] bg-white p-5"><h2 className="font-semibold">Record collection · {collecting.order_number}</h2><p className="mt-2 text-sm">{collecting.user?.name} · ₱{Number(collecting.total_amount).toFixed(2)}</p><p className="mt-2 text-sm text-slate-600">Booking preference: {collecting.payment_preference || "Not recorded"}. Choose the method actually received.</p><label className="mt-4 block text-sm">Actual collection method<select disabled={saving} value={method} onChange={e => setMethod(e.target.value)} className="mt-2 block rounded-lg border p-3"><option value="">Choose actual method</option><option>Cash</option><option>GCash</option></select></label><p className="mt-3 text-sm text-slate-600">Confirm the full amount was received before saving. This records payment; it does not process a transfer.</p><div className="mt-4 flex gap-3"><button disabled={saving} onClick={recordCollection} className="rounded-lg bg-emerald-800 px-4 py-3 font-semibold text-white">{saving ? "Saving..." : "Confirm full payment received"}</button><button disabled={saving} onClick={() => setCollecting(null)} className="rounded-lg border px-4 py-3">Cancel</button></div></section>}
        <section className="grid gap-4 sm:grid-cols-3">
          <SummaryCard label="Paid Orders" value={paidOrders.length} />
          <SummaryCard label="Unpaid Orders" value={unpaidOrders.length} />
          <SummaryCard
            label="Paid Revenue"
            value={`₱${paidRevenue.toFixed(2)}`}
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#dbe7f3] bg-white">
          <div className="flex flex-col gap-4 border-b border-[#e3edf6] px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-semibold text-[#17395d]">
                Payment Ledger
              </h2>
              <p className="mt-1 text-xs text-[#8098ae]">
                Payment records from customer orders.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search payments by order, customer or method"
                placeholder="Search payment..."
                className="rounded-lg border border-[#cfdeeb] px-3 py-2 text-sm outline-none"
              />

              <select
                aria-label="Filter payments by status"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className="rounded-lg border border-[#cfdeeb] bg-white px-3 py-2 text-sm"
              >
                <option value="All">All payments</option>
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <p className="p-5 text-sm text-[#7892ad]">
              Loading payments...
            </p>
          ) : filteredOrders.length === 0 ? (
            <p className="p-5 text-sm text-[#7892ad]">
              No payment records found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#f7fafd] text-xs uppercase tracking-wide text-[#7892ad]">
                  <tr>
                    <th className="px-5 py-3">Order</th>
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Method</th>
                    <th className="px-5 py-3">Paid At</th><th className="px-5 py-3">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#edf3f8]">
                  {filteredOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="px-5 py-4 font-medium text-[#17395d]">
                        {order.order_number}
                      </td>

                      <td className="px-5 py-4 text-[#5e7891]">
                        {order.user?.name ?? "Unknown customer"}
                      </td>

                      <td className="px-5 py-4 font-medium text-[#17395d]">
                        {order.total_amount === null || Number(order.total_amount) <= 0 ? "Awaiting pricing" : `₱${Number(order.total_amount).toFixed(2)}`}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            order.payment_status === "Paid"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {order.payment_status}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-[#5e7891]">
                        {order.payment_method ?? "—"}
                      </td>

                      <td className="px-5 py-4 text-[#5e7891]">
                        {order.paid_at
                          ? new Date(order.paid_at).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-5 py-4"><div className="flex flex-col items-start gap-2">{order.payment_status === "Unpaid" && <button disabled={saving || Number(order.total_amount || 0) <= 0} onClick={() => { setCollecting(order); setMethod(""); setError(""); setSuccess(""); setTimeout(() => document.getElementById("collection-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); }} className="rounded-lg bg-[#17395d] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Record collection</button>}<a className="text-sm font-semibold underline" href={`/orders?order=${order.id}`}>Open order →</a>{order.payment_status === "Unpaid" && Number(order.total_amount || 0) <= 0 && <span className="text-xs text-slate-600">Record weight and price in Orders first.</span>}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
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