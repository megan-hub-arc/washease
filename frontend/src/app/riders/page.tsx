"use client";

import { API_URL } from "@/lib/api";
import { useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";

type Rider = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
};

export default function RidersPage() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadRiders() {
      const token = localStorage.getItem("washease_token");

      if (!token) {
        setError("Authentication token not found.");
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/staff/riders`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(
            `Unable to load riders (${response.status}).`
          );
        }

        const data = await response.json();

        setRiders(Array.isArray(data) ? data : []);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Unable to load riders."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadRiders();
  }, []);

  return (
    <AdminShell title="Riders">
      <div className="mx-auto max-w-7xl space-y-6">
        <section>
          <p className="text-sm text-[#6f89a3]">
            View delivery personnel available for staff-managed rider
            assignment.
          </p>
        </section>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2">
          <SummaryCard label="Registered Riders" value={riders.length} />
          <div className="rounded-2xl border border-[#dbe7f3] bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-[#8ba2b8]">
              Assignment
            </p>
            <p className="mt-2 text-sm text-[#4f7192]">
              Rider assignment is managed from the Deliveries module.
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#dbe7f3] bg-white">
          <div className="border-b border-[#e3edf6] px-5 py-4">
            <h2 className="font-semibold text-[#17395d]">
              Delivery Riders
            </h2>
            <p className="mt-1 text-xs text-[#8098ae]">
              Personnel available when creating delivery runs.
            </p>
          </div>

          {isLoading ? (
            <p className="p-5 text-sm text-[#7892ad]">
              Loading riders...
            </p>
          ) : riders.length === 0 ? (
            <p className="p-5 text-sm text-[#7892ad]">
              No riders found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#f7fafd] text-xs uppercase tracking-wide text-[#7892ad]">
                  <tr>
                    <th className="px-5 py-3">Rider</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Phone</th>
                    <th className="px-5 py-3">Role</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#edf3f8]">
                  {riders.map((rider) => (
                    <tr key={rider.id}>
                      <td className="px-5 py-4 font-medium text-[#17395d]">
                        {rider.name}
                      </td>

                      <td className="px-5 py-4 text-[#5e7891]">
                        {rider.email}
                      </td>

                      <td className="px-5 py-4 text-[#5e7891]">
                        {rider.phone ?? "—"}
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full bg-[#e8f3fc] px-2.5 py-1 text-xs font-medium text-[#28618e]">
                          Rider
                        </span>
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