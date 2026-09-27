"use client";

import { useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";

type DeliveryZone = {
  id: number;
  name: string;
};

type Address = {
  id: number;
  address: string;
  zone: string | null;
  delivery_zone: DeliveryZone | null;
};

type Customer = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
};

type Order = {
  id: number;
  order_number: string;
  service_type: string;
  weight: string | number | null;
  total_amount: string | number;
  payment_status: string;
  payment_method: string | null;
  status: string;
  delivery_status: string | null;
  requested_at: string | null;
  created_at: string;
  user: Customer;
  address: Address | null;
};

const filters = [
  "All",
  "Pending",
  "Confirmed",
  "Picked Up",
  "Processing",
  "Ready for Delivery",
  "Delivered",
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [search, setSearch] = useState("");
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
        const response = await fetch(
          "http://127.0.0.1:8000/api/staff/orders",
          {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(
            `Unable to load orders (${response.status}).`
          );
        }

        const data = await response.json();

        setOrders(Array.isArray(data) ? data : [data]);
      } catch (error) {
        if (error instanceof Error) {
          setError(error.message);
        } else {
          setError("Unable to load orders.");
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesFilter =
        selectedFilter === "All" ||
        order.status === selectedFilter;

      const matchesSearch =
        !query ||
        order.order_number.toLowerCase().includes(query) ||
        order.user?.name?.toLowerCase().includes(query) ||
        order.service_type?.toLowerCase().includes(query) ||
        order.address?.delivery_zone?.name
          ?.toLowerCase()
          .includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [orders, search, selectedFilter]);

  function filterCount(filter: string) {
    if (filter === "All") {
      return orders.length;
    }

    return orders.filter((order) => order.status === filter).length;
  }

  return (
    <AdminShell title="Orders">
      <section>
        <div>
          <h2 className="text-xl font-bold text-[#17395d]">
            Orders
          </h2>

          <p className="mt-1 text-sm text-[#7892ad]">
            {orders.length} total{" "}
            {orders.length === 1 ? "order" : "orders"}
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative xl:w-72">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8ba2b8]">
              ⌕
            </span>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search orders..."
              className="w-full rounded-xl border border-[#dbe7f3] bg-white py-2.5 pl-10 pr-4 text-sm text-[#17395d] outline-none transition focus:border-[#299cdb] focus:ring-4 focus:ring-[#e7f4fd]"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {filters.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setSelectedFilter(filter)}
                className={`whitespace-nowrap rounded-full border px-3 py-2 text-xs font-medium transition ${
                  selectedFilter === filter
                    ? "border-[#299cdb] bg-[#edf7ff] text-[#178fd0]"
                    : "border-[#dbe7f3] bg-white text-[#7892ad] hover:bg-[#f7fbff]"
                }`}
              >
                {filter} {filterCount(filter)}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-5 overflow-hidden rounded-xl border border-[#dbe7f3] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead className="bg-[#f8fbfe]">
                <tr className="border-b border-[#dbe7f3] text-xs font-semibold uppercase tracking-wide text-[#91a8be]">
                  <th className="px-5 py-4">Order ID</th>
                  <th className="px-5 py-4">Customer</th>
                  <th className="px-5 py-4">Service</th>
                  <th className="px-5 py-4">Weight</th>
                  <th className="px-5 py-4">Zone</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Payment</th>
                  <th className="px-5 py-4 text-right">
                    Amount
                  </th>
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-12 text-center text-sm text-[#7892ad]"
                    >
                      Loading orders...
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-12 text-center text-sm text-[#7892ad]"
                    >
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <OrderRow key={order.id} order={order} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}

function OrderRow({ order }: { order: Order }) {
  const amount = Number(order.total_amount ?? 0);

  return (
    <tr className="border-b border-[#edf2f7] last:border-b-0 hover:bg-[#fbfdff]">
      <td className="px-5 py-4">
        <p className="font-semibold text-[#17395d]">
          {order.order_number}
        </p>

        <p className="mt-1 text-xs text-[#91a8be]">
          {formatDate(order.created_at)}
        </p>
      </td>

      <td className="px-5 py-4">
        <p className="font-medium text-[#17395d]">
          {order.user?.name ?? "Unknown customer"}
        </p>

        <p className="mt-1 text-xs text-[#91a8be]">
          {order.user?.phone ?? order.user?.email ?? "—"}
        </p>
      </td>

      <td className="px-5 py-4 text-sm text-[#567795]">
        {order.service_type}
      </td>

      <td className="px-5 py-4 text-sm text-[#567795]">
        {order.weight ? `${order.weight} kg` : "—"}
      </td>

      <td className="px-5 py-4 text-sm text-[#567795]">
        {order.address?.delivery_zone?.name ??
          order.address?.zone ??
          "Unassigned"}
      </td>

      <td className="px-5 py-4">
        <StatusBadge status={order.status} />
      </td>

      <td className="px-5 py-4">
        <PaymentBadge status={order.payment_status} />
      </td>

      <td className="px-5 py-4 text-right font-semibold text-[#17395d]">
        ₱
        {amount.toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style =
    status === "Delivered"
      ? "bg-emerald-50 text-emerald-700"
      : status === "Ready for Delivery"
        ? "bg-green-50 text-green-700"
        : status === "Processing"
          ? "bg-blue-50 text-blue-700"
          : status === "Picked Up"
            ? "bg-violet-50 text-violet-700"
            : status === "Confirmed"
              ? "bg-cyan-50 text-cyan-700"
              : "bg-amber-50 text-amber-700";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${style}`}
    >
      {status}
    </span>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const isPaid = status === "Paid";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        isPaid
          ? "bg-emerald-50 text-emerald-700"
          : "bg-orange-50 text-orange-700"
      }`}
    >
      {status}
    </span>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}