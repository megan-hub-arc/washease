"use client";

import StaffCustomerIntake from "@/components/StaffCustomerIntake";
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
  label: string | null;
  address: string;
  delivery_zone: DeliveryZone | null;
};

type Order = {
  id: number;
  order_number: string;
  status: string;
  payment_status: string;
  total_amount: string | number | null;
};

type Customer = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  addresses: Address[];
  orders: Order[];
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCustomers() {
      const token = localStorage.getItem("washease_token");

      if (!token) {
        setError("Authentication token not found.");
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/staff/customers`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(
            `Unable to load customers (${response.status}).`
          );
        }

        const data = await response.json();

        setCustomers(Array.isArray(data) ? data : []);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Unable to load customers."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return customers;
    }

    return customers.filter((customer) => {
      return (
        customer.name.toLowerCase().includes(query) ||
        (customer.email ?? "").toLowerCase().includes(query) ||
        (customer.phone ?? "").toLowerCase().includes(query)
      );
    });
  }, [customers, search]);

  const totalOrders = customers.reduce(
    (sum, customer) => sum + customer.orders.length,
    0
  );

  const totalAddresses = customers.reduce(
    (sum, customer) => sum + customer.addresses.length,
    0
  );

  return (
    <AdminShell title="Customers">
      <div className="mx-auto max-w-7xl space-y-6">
        <section>
          <p className="text-sm text-[#6f89a3]">
            View registered WashEase customers, their saved addresses, and
            order activity.
          </p>
        </section>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <StaffCustomerIntake customers={customers} onSaved={saved => {
          setCustomers(current => [...current.filter(customer => customer.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name)));
          setSelectedCustomer(current => current?.id === saved.id ? saved : current);
        }} />

        <section className="grid gap-4 sm:grid-cols-3">
          <SummaryCard label="Customers" value={customers.length} />
          <SummaryCard label="Saved Addresses" value={totalAddresses} />
          <SummaryCard label="Customer Orders" value={totalOrders} />
        </section>

        <section className="rounded-2xl border border-[#dbe7f3] bg-white">
          <div className="flex flex-col gap-4 border-b border-[#e3edf6] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-[#17395d]">
                Customer Records
              </h2>
              <p className="mt-1 text-xs text-[#8098ae]">
                Registered customer accounts and activity.
              </p>
            </div>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search customers by name, email or phone"
              placeholder="Search customer..."
              className="w-full rounded-lg border border-[#cfdeeb] px-3 py-2 text-sm outline-none focus:border-[#68a9d7] sm:max-w-xs"
            />
          </div>

          {isLoading ? (
            <p className="p-5 text-sm text-[#7892ad]">
              Loading customers...
            </p>
          ) : filteredCustomers.length === 0 ? (
            <p className="p-5 text-sm text-[#7892ad]">
              No customers found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#f7fafd] text-xs uppercase tracking-wide text-[#7892ad]">
                  <tr>
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3">Phone</th>
                    <th className="px-5 py-3">Addresses</th>
                    <th className="px-5 py-3">Orders</th>
                    <th className="px-5 py-3">Saved address</th><th className="px-5 py-3">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#edf3f8]">
                  {filteredCustomers.map((customer) => {
                    const firstAddress = customer.addresses[0];

                    return (
                      <tr key={customer.id}>
                        <td className="px-5 py-4">
                          <p className="font-medium text-[#17395d]">
                            {customer.name}
                          </p>
                          <p className="mt-1 text-xs text-[#8aa0b5]">
                            {customer.email || "No email provided"}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-[#5e7891]">
                          {customer.phone ?? "—"}
                        </td>

                        <td className="px-5 py-4 text-[#5e7891]">
                          {customer.addresses.length}
                        </td>

                        <td className="px-5 py-4 text-[#5e7891]">
                          {customer.orders.length}
                        </td>

                        <td className="px-5 py-4">
                          {firstAddress ? (
                            <>
                              <p className="max-w-sm text-[#4f7192]">
                                {firstAddress.address}
                              </p>
                              <p className="mt-1 text-xs text-[#8aa0b5]">
                                {firstAddress.delivery_zone?.name ??
                                  "Unassigned zone"}
                              </p>
                            </>
                          ) : (
                            <span className="text-[#8aa0b5]">
                              No saved address
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4"><button type="button" onClick={() => { setSelectedCustomer(customer); setTimeout(() => document.getElementById("customer-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); }} className="whitespace-nowrap rounded-lg border px-3 py-2 font-semibold">View customer</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        {selectedCustomer && <section id="customer-detail" className="scroll-mt-24 rounded-xl border bg-white p-5"><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold">{selectedCustomer.name}</h2><p className="mt-2 text-sm">{selectedCustomer.email || "No email provided"} · {selectedCustomer.phone || "No phone provided"}</p></div><button onClick={() => setSelectedCustomer(null)} className="rounded-lg border px-3 py-2">Close</button></div><h3 className="mt-5 font-semibold">Saved addresses</h3>{selectedCustomer.addresses.map(address => <p key={address.id} className="mt-2 text-sm">{address.label ? `${address.label}: ` : ""}{address.address} · {address.delivery_zone?.name || "Zone not assigned"}</p>)}{!selectedCustomer.addresses.length && <p className="mt-2 text-sm">No saved addresses.</p>}<h3 className="mt-5 font-semibold">Order history</h3><div className="mt-3 space-y-2">{selectedCustomer.orders.map(order => <a key={order.id} href={`/orders?order=${order.id}`} className="block rounded-lg border p-3 text-sm hover:bg-slate-50"><strong>{order.order_number}</strong> · {order.status} · {order.payment_status} · {Number(order.total_amount || 0) > 0 ? `₱${Number(order.total_amount).toFixed(2)}` : "Awaiting pricing"}<span className="ml-2 font-semibold">Open order →</span></a>)}{!selectedCustomer.orders.length && <p className="text-sm">No orders yet.</p>}</div></section>}
      </div>
    </AdminShell>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
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