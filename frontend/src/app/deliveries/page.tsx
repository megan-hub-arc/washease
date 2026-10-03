"use client";

import { API_URL } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";

type DeliveryZone = {
  id: number;
  name: string;
  priority_order: number;
  is_active: boolean;
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

type Rider = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
};

type Order = {
  id: number;
  order_number: string;
  delivery_run_id: number | null;
  weight: string | number | null;
  status: string;
  delivery_status: string | null;
  delivery_sequence: number | null;
  requested_at: string | null;
  scheduled_at: string | null;
  user: Customer;
  address: Address | null;
};

type ZoneGroup = {
  id: number | string;
  name: string;
  priority: number;
  orders: Order[];
};

export default function DeliveriesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [riders, setRiders] = useState<Rider[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedRiderId, setSelectedRiderId] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");

  useEffect(() => {
    async function loadDeliveries() {
      const token = localStorage.getItem("washease_token");

      if (!token) {
        setError("Authentication token not found.");
        setIsLoading(false);
        return;
      }

      try {
       const [ordersResponse, ridersResponse] = await Promise.all([
  fetch(`${API_URL}/staff/orders`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  }),
  fetch(`${API_URL}/staff/riders`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  }),
]);

if (!ordersResponse.ok) {
  throw new Error(
    `Unable to load delivery data (${ordersResponse.status}).`
  );
}

if (!ridersResponse.ok) {
  throw new Error(
    `Unable to load riders (${ridersResponse.status}).`
  );
}

const ordersData = await ordersResponse.json();
const ridersData = await ridersResponse.json();

const orderList: Order[] = Array.isArray(ordersData)
  ? ordersData
  : [ordersData];

const riderList: Rider[] = Array.isArray(ridersData)
  ? ridersData
  : [];

setOrders(orderList);
setRiders(riderList);
      } catch (error) {
        if (error instanceof Error) {
          setError(error.message);
        } else {
          setError("Unable to load delivery data.");
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadDeliveries();
  }, []);

  const deliveryOrders = useMemo(() => {
    return orders
      .filter(
        (order) =>
          order.status === "Ready for Delivery" &&
          order.delivery_status === "Scheduled" &&
          order.delivery_sequence !== null
      )
      .sort(
        (a, b) =>
          (a.delivery_sequence ?? Number.MAX_SAFE_INTEGER) -
          (b.delivery_sequence ?? Number.MAX_SAFE_INTEGER)
      );
  }, [orders]);

  const zoneGroups = useMemo<ZoneGroup[]>(() => {
    const groups = new Map<string, ZoneGroup>();

    deliveryOrders.forEach((order) => {
      const zone = order.address?.delivery_zone;

      const key = zone
        ? String(zone.id)
        : `unassigned-${order.address?.zone ?? "unknown"}`;

      if (!groups.has(key)) {
        groups.set(key, {
          id: zone?.id ?? key,
          name:
            zone?.name ??
            order.address?.zone ??
            "Unassigned Zone",
          priority: zone?.priority_order ?? 999,
          orders: [],
        });
      }

      groups.get(key)?.orders.push(order);
    });

    return Array.from(groups.values()).sort(
      (a, b) => a.priority - b.priority
    );
  }, [deliveryOrders]);

  const totalWeight = deliveryOrders.reduce(
    (sum, order) => sum + Number(order.weight ?? 0),
    0
  );

  const assignedCount = deliveryOrders.filter(
    (order) => order.delivery_run_id !== null
  ).length;

  const unassignedCount =
    deliveryOrders.length - assignedCount;
  async function handleAssignRider() {
  if (!selectedOrder || !selectedRiderId) {
    setAssignmentError("Please select a rider.");
    return;
  }

  const token = localStorage.getItem("washease_token");

  if (!token) {
    setAssignmentError("Authentication token not found.");
    return;
  }

  setIsAssigning(true);
  setAssignmentError("");

  try {
    const runResponse = await fetch(
      `${API_URL}/staff/delivery-runs`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rider_id: Number(selectedRiderId),
          capacity_kg: Math.max(
            8,
            Number(selectedOrder.weight ?? 0)
          ),
        }),
      }
    );

    const runData = await runResponse.json();

    if (!runResponse.ok) {
      throw new Error(
        runData.message ?? "Unable to create delivery run."
      );
    }

    const deliveryRunId = runData.delivery_run.id;

    const assignResponse = await fetch(
      `${API_URL}/staff/delivery-runs/${deliveryRunId}/orders`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          order_ids: [selectedOrder.id],
        }),
      }
    );

    const assignData = await assignResponse.json();

    if (!assignResponse.ok) {
      throw new Error(
        assignData.message ?? "Unable to assign order."
      );
    }

    setOrders((currentOrders) =>
      currentOrders.map((order) =>
        order.id === selectedOrder.id
          ? {
              ...order,
              delivery_run_id: deliveryRunId,
            }
          : order
      )
    );

    setSelectedOrder(null);
    setSelectedRiderId("");
  } catch (error) {
    if (error instanceof Error) {
      setAssignmentError(error.message);
    } else {
      setAssignmentError("Unable to assign rider.");
    }
  } finally {
    setIsAssigning(false);
  }
}
  return (
    <AdminShell title="Deliveries">
      <section>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold text-[#17395d]">
            Deliveries
          </h2>

          <span className="rounded-full bg-[#173f66] px-3 py-1 text-[11px] font-semibold text-white">
            ZTLPA Sequence
          </span>
        </div>

        <p className="mt-1 text-sm text-[#7892ad]">
          {deliveryOrders.length}{" "}
          {deliveryOrders.length === 1
            ? "order"
            : "orders"}{" "}
          scheduled for delivery
        </p>

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <SummaryCard
            label="Scheduled"
            value={isLoading ? "..." : deliveryOrders.length}
            detail={`${totalWeight.toFixed(2)} kg total load`}
          />

          <SummaryCard
            label="Awaiting assignment"
            value={isLoading ? "..." : unassignedCount}
            detail="No delivery run yet"
          />

          <SummaryCard
            label="Assigned"
            value={isLoading ? "..." : assignedCount}
            detail="Added to delivery runs"
          />
        </div>
        
        <div className="mt-5 space-y-4">
          {isLoading ? (
            <div className="rounded-xl border border-[#dbe7f3] bg-white px-5 py-12 text-center text-sm text-[#7892ad]">
              Loading ZTLPA sequence...
            </div>
          ) : zoneGroups.length === 0 ? (
            <div className="rounded-xl border border-[#dbe7f3] bg-white px-5 py-12 text-center">
              <p className="font-semibold text-[#17395d]">
                No scheduled deliveries
              </p>

              <p className="mt-1 text-sm text-[#7892ad]">
                ZTLPA scheduled orders will appear here.
              </p>
            </div>
          ) : (
            zoneGroups.map((group) => (
              <ZoneDeliveryGroup
                key={group.id}
                group={group}
                onAssign={setSelectedOrder}
              />
            ))
          )}
        </div>
          {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-[#17395d]">
                    Assign Rider
                  </h3>

                  <p className="mt-1 text-sm text-[#7892ad]">
                    Create a delivery run for this scheduled order.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedOrder(null);
                    setSelectedRiderId("");
                    setAssignmentError("");
                  }}
                  className="text-xl text-[#7892ad] hover:text-[#17395d]"
                >
                  ×
                </button>
              </div>

              <div className="mt-5 rounded-xl bg-[#f8fbfe] p-4">
                <p className="font-semibold text-[#17395d]">
                  {selectedOrder.order_number}
                </p>

                <p className="mt-1 text-sm text-[#7892ad]">
                  {selectedOrder.user?.name ?? "Unknown customer"}
                  {" · "}
                  {Number(selectedOrder.weight ?? 0).toFixed(2)} kg
                </p>
              </div>

              <label className="mt-5 block text-sm font-semibold text-[#17395d]">
                Rider
              </label>

              <select
                value={selectedRiderId}
                onChange={(event) => {
                  setSelectedRiderId(event.target.value);
                  setAssignmentError("");
                }}
                className="mt-2 w-full rounded-xl border border-[#dbe7f3] bg-white px-4 py-3 text-sm text-[#17395d] outline-none focus:border-[#299cdb]"
              >
                <option value="">Select a rider</option>

                {riders.map((rider) => (
                  <option key={rider.id} value={rider.id}>
                    {rider.name}
                    {rider.phone ? ` · ${rider.phone}` : ""}
                  </option>
                ))}
              </select>

              {riders.length === 0 && (
                <p className="mt-2 text-xs text-amber-700">
                  No rider accounts are available.
                </p>
              )}

              {assignmentError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {assignmentError}
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={isAssigning}
                  onClick={() => {
                    setSelectedOrder(null);
                    setSelectedRiderId("");
                    setAssignmentError("");
                  }}
                  className="rounded-xl border border-[#dbe7f3] px-4 py-2 text-sm font-semibold text-[#17395d]"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={
                    isAssigning ||
                    !selectedRiderId ||
                    riders.length === 0
                  }
                  onClick={handleAssignRider}
                  className="rounded-xl bg-[#299cdb] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isAssigning ? "Assigning..." : "Assign Rider"}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </AdminShell>
  );
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <article className="rounded-xl border border-[#dbe7f3] bg-white p-5">
      <p className="text-sm text-[#7892ad]">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-[#17395d]">
        {value}
      </p>

      <p className="mt-1 text-xs text-[#91a8be]">
        {detail}
      </p>
    </article>
  );
}

function ZoneDeliveryGroup({
  group,
  onAssign,
}: {
  group: ZoneGroup;
  onAssign: (order: Order) => void;
}) {
  const zoneWeight = group.orders.reduce(
    (sum, order) => sum + Number(order.weight ?? 0),
    0
  );

  return (
    <article className="overflow-hidden rounded-xl border border-[#dbe7f3] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dbe7f3] bg-[#f8fbfe] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="text-[#299cdb]">
            ⌖
          </span>

          <h3 className="font-semibold text-[#17395d]">
            {group.name}
          </h3>
        </div>

        <p className="text-xs text-[#7892ad]">
          {group.orders.length}{" "}
          {group.orders.length === 1
            ? "order"
            : "orders"}{" "}
          · {zoneWeight.toFixed(2)} kg
        </p>
      </div>

      <div>
        {group.orders.map((order) => (
          <DeliveryRow
            key={order.id}
            order={order}
            onAssign={onAssign}
            />
        ))}
      </div>
    </article>
  );
}

function DeliveryRow({
  order,
  onAssign,
}: {
  order: Order;
  onAssign: (order: Order) => void;
}) {
  const isAssigned = order.delivery_run_id !== null;

  return (
    <div className="flex flex-col gap-4 border-b border-[#edf2f7] px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eaf5ff] text-sm font-bold text-[#299cdb]">
          {order.delivery_sequence}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-[#17395d]">
              {order.user?.name ?? "Unknown customer"}
            </p>

            <span className="rounded-full bg-green-50 px-2 py-1 text-[11px] font-semibold text-green-700">
              {order.status}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-[#7892ad]">
            <span>{order.order_number}</span>
            <span>·</span>
            <span>
              {Number(order.weight ?? 0).toFixed(2)} kg
            </span>

            {order.requested_at && (
              <>
                <span>·</span>
                <span>
                  Requested {formatTime(order.requested_at)}
                </span>
              </>
            )}
          </div>

          <p className="mt-2 text-xs text-[#91a8be]">
            {order.address?.address ?? "No address"}
          </p>
        </div>
      </div>

      <div className="shrink-0">
        {isAssigned ? (
          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
            Assigned to run #{order.delivery_run_id}
          </span>
        ) : (
          <button
  type="button"
  onClick={() => onAssign(order)}
  className="rounded-full bg-[#299cdb] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#238ac2]"
>
  Assign rider
</button>
        )}
      </div>
    </div>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}