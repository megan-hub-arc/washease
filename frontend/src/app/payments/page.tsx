"use client";

import { useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";

type Customer = {
  id: number;
  name: string;
  email: string;
};

type Order = {
  id: number;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  total_amount: string | number | null;
  paid_at: string | null;
  user: Customer | null;
};

const API_URL = "http://127.0.0.1:8000/api";

export default function PaymentsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
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
          Payment updates are managed from the Orders module.
        </p>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

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
                placeholder="Search payment..."
                className="rounded-lg border border-[#cfdeeb] px-3 py-2 text-sm outline-none"
              />

              <select
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
                    <th className="px-5 py-3">Paid At</th>
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
                        ₱{Number(order.total_amount ?? 0).toFixed(2)}
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