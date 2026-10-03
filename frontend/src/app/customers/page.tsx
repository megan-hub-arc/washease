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
  email: string;
  phone: string | null;
  addresses: Address[];
  orders: Order[];
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
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
        customer.email.toLowerCase().includes(query) ||
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
                    <th className="px-5 py-3">Latest Address</th>
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
                            {customer.email}
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
                      </tr>
                    );
                  })}
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