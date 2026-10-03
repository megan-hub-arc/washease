"use client";

import { API_URL } from "@/lib/api";
import { FormEvent, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";

type DeliveryZone = {
  id: number;
  name: string;
  priority_order: number;
  is_active: boolean;
};

type Customer = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
};

type Address = {
  id: number;
  user_id: number;
  archived_at: string | null;
  delivery_zone_id: number | null;
  label: string | null;
  address: string;
  zone: string | null;
  notes: string | null;
  user: Customer;
  delivery_zone: DeliveryZone | null;
};

type ZoneForm = {
  name: string;
  priority_order: string;
  is_active: boolean;
};

export default function ZonesPage() {
  const [addressSearch, setAddressSearch] = useState("");
  const [onlyUnassigned, setOnlyUnassigned] = useState(true);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState<ZoneForm>({
    name: "",
    priority_order: "1",
    is_active: true,
  });

  const [editingZoneId, setEditingZoneId] = useState<number | null>(null);
  const [isSavingZone, setIsSavingZone] = useState(false);
  const [assigningAddressId, setAssigningAddressId] = useState<number | null>(
    null
  );

  useEffect(() => {
    async function loadData() {
      const token = localStorage.getItem("washease_token");

      if (!token) {
        setError("Authentication token not found.");
        setIsLoading(false);
        return;
      }

      try {
        const [zonesResponse, addressesResponse] = await Promise.all([
          fetch(`${API_URL}/staff/delivery-zones`, {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch(`${API_URL}/staff/addresses`, {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        if (!zonesResponse.ok) {
          throw new Error(
            `Unable to load delivery zones (${zonesResponse.status}).`
          );
        }

        if (!addressesResponse.ok) {
          throw new Error(
            `Unable to load customer addresses (${addressesResponse.status}).`
          );
        }

        const zonesData = await zonesResponse.json();
        const addressesData = await addressesResponse.json();

        setZones(Array.isArray(zonesData) ? zonesData : []);
        setAddresses(Array.isArray(addressesData) ? addressesData : []);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Unable to load zone management data."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  const activeZones = useMemo(
    () => zones.filter((zone) => zone.is_active),
    [zones]
  );

  const assignedCount = addresses.filter(
    (address) => address.delivery_zone_id !== null
  ).length;

  const unassignedCount = addresses.length - assignedCount;

  function resetForm() {
    setEditingZoneId(null);
    setForm({
      name: "",
      priority_order: String(zones.length + 1),
      is_active: true,
    });
  }

  function startEditing(zone: DeliveryZone) {
    setEditingZoneId(zone.id);
    setForm({
      name: zone.name,
      priority_order: String(zone.priority_order),
      is_active: zone.is_active,
    });
    setError("");
    setSuccess("");
  }

  async function saveZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = localStorage.getItem("washease_token");

    if (!token) {
      setError("Authentication token not found.");
      return;
    }

    const priority = Number(form.priority_order);

    if (!form.name.trim()) {
      setError("Zone name is required.");
      return;
    }

    if (!Number.isInteger(priority) || priority < 1) {
      setError("Priority must be a whole number greater than zero.");
      return;
    }

    setIsSavingZone(true);
    setError("");
    setSuccess("");

    try {
      const isEditing = editingZoneId !== null;

      const response = await fetch(
        isEditing
          ? `${API_URL}/staff/delivery-zones/${editingZoneId}`
          : `${API_URL}/staff/delivery-zones`,
        {
          method: isEditing ? "PUT" : "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: form.name.trim(),
            priority_order: priority,
            is_active: form.is_active,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? `Unable to save zone (${response.status}).`);
      }

      const savedZone: DeliveryZone = data.delivery_zone;

      setZones((currentZones) => {
        const exists = currentZones.some((zone) => zone.id === savedZone.id);

        const nextZones = exists
          ? currentZones.map((zone) =>
              zone.id === savedZone.id ? savedZone : zone
            )
          : [...currentZones, savedZone];

        return nextZones.sort(
          (a, b) => a.priority_order - b.priority_order
        );
      });

      setAddresses((currentAddresses) =>
        currentAddresses.map((address) =>
          address.delivery_zone_id === savedZone.id
            ? {
                ...address,
                delivery_zone: savedZone,
              }
            : address
        )
      );

      setSuccess(
        isEditing
          ? "Delivery zone updated successfully."
          : "Delivery zone created successfully."
      );

      setEditingZoneId(null);
      setForm({
        name: "",
        priority_order: String(
          isEditing ? zones.length + 1 : zones.length + 2
        ),
        is_active: true,
      });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to save delivery zone."
      );
    } finally {
      setIsSavingZone(false);
    }
  }

  async function assignAddress(addressId: number, deliveryZoneId: number) {
    const token = localStorage.getItem("washease_token");

    if (!token) {
      setError("Authentication token not found.");
      return;
    }

    setAssigningAddressId(addressId);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/staff/addresses/${addressId}/zone`,
        {
          method: "PUT",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            delivery_zone_id: deliveryZoneId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ?? `Unable to assign address (${response.status}).`
        );
      }

      const updatedAddress: Address = data.address;

      setAddresses((currentAddresses) =>
        currentAddresses.map((address) =>
          address.id === updatedAddress.id
            ? {
                ...address,
                ...updatedAddress,
                user: updatedAddress.user ?? address.user,
              }
            : address
        )
      );

      setSuccess("Customer address zone updated successfully.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to assign the customer address."
      );
    } finally {
      setAssigningAddressId(null);
    }
  }

  const visibleAddresses = addresses.filter(address => (!onlyUnassigned || !address.delivery_zone_id) && `${address.user?.name || ""} ${address.address}`.toLowerCase().includes(addressSearch.toLowerCase()));

  return (
    <AdminShell title="Delivery Zones">
      <div className="mx-auto max-w-7xl space-y-6">
        <section>
          <p className="text-sm text-[#6f89a3]">
            Configure service areas used by ZTLPA and assign customer addresses
            to their correct delivery zone.
          </p>
        </section>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        )}

        {unassignedCount > 0 && <a href="#address-assignment" className="block rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{unassignedCount} addresses need a zone before delivery scheduling. Assign zones below →</a>}
        <section className="grid gap-4 sm:grid-cols-3">
          <SummaryCard label="Delivery Zones" value={zones.length} />
          <SummaryCard label="Assigned Addresses" value={assignedCount} />
          <SummaryCard label="Unassigned Addresses" value={unassignedCount} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="overflow-hidden rounded-2xl border border-[#dbe7f3] bg-white">
            <div className="border-b border-[#e3edf6] px-5 py-4">
              <h2 className="font-semibold text-[#17395d]">
                Configured Zones
              </h2>
              <p className="mt-1 text-xs text-[#8098ae]">
                Lower priority numbers are processed first by zone priority.
              </p>
            </div>

            {isLoading ? (
              <p className="p-5 text-sm text-[#7892ad]">
                Loading delivery zones...
              </p>
            ) : zones.length === 0 ? (
              <p className="p-5 text-sm text-[#7892ad]">
                No delivery zones have been configured.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#f7fafd] text-xs uppercase tracking-wide text-[#7892ad]">
                    <tr>
                      <th className="px-5 py-3">Zone</th>
                      <th className="px-5 py-3">Priority</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#edf3f8]">
                    {zones.map((zone) => (
                      <tr key={zone.id}>
                        <td className="px-5 py-4 font-medium text-[#17395d]">
                          {zone.name}
                        </td>

                        <td className="px-5 py-4 text-[#5e7891]">
                          {zone.priority_order}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              zone.is_active
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {zone.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => { startEditing(zone); document.getElementById("zone-form")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
                            className="rounded-lg border border-[#cfe0ef] px-3 py-1.5 text-xs font-medium text-[#28618e] hover:bg-[#f2f8fd]"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <form
            id="zone-form"
            onSubmit={saveZone}
            className="h-fit rounded-2xl border border-[#dbe7f3] bg-white p-5"
          >
            <h2 className="font-semibold text-[#17395d]">
              {editingZoneId === null ? "Add Delivery Zone" : "Edit Delivery Zone"}
            </h2>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[#5e7891]">
                  Zone name
                </span>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Example: Ampayon"
                  className="w-full rounded-lg border border-[#cfdeeb] px-3 py-2.5 text-sm outline-none focus:border-[#68a9d7]"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[#5e7891]">
                  Priority order
                </span>
                <input
                  type="number"
                  min="1"
                  value={form.priority_order}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      priority_order: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[#cfdeeb] px-3 py-2.5 text-sm outline-none focus:border-[#68a9d7]"
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-[#4f7192]">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      is_active: event.target.checked,
                    }))
                  }
                />
                Active service zone
              </label>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="submit"
                disabled={isSavingZone}
                className="rounded-lg bg-[#173f66] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {isSavingZone
                  ? "Saving..."
                  : editingZoneId === null
                    ? "Add Zone"
                    : "Save Changes"}
              </button>

              {editingZoneId !== null && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-[#cfdeeb] px-4 py-2.5 text-sm text-[#5e7891]"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section id="address-assignment" className="scroll-mt-24 overflow-hidden rounded-2xl border border-[#dbe7f3] bg-white">
          <div className="border-b border-[#e3edf6] px-5 py-4">
            <h2 className="font-semibold text-[#17395d]">
              Customer Address Assignment
            </h2>
            <p className="mt-1 text-xs text-[#8098ae]">
              Assign each customer address to an active delivery zone for ZTLPA
              scheduling.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 border-b p-4"><label className="text-sm">Find address<input type="search" value={addressSearch} onChange={e => setAddressSearch(e.target.value)} placeholder="Customer or address" className="ml-2 rounded-lg border p-2" /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyUnassigned} onChange={e => setOnlyUnassigned(e.target.checked)} />Only addresses without a zone</label></div>
          {isLoading ? (
            <p className="p-5 text-sm text-[#7892ad]">
              Loading customer addresses...
            </p>
          ) : visibleAddresses.length === 0 ? (
            <p className="p-5 text-sm text-[#7892ad]">
              No addresses match these filters. Clear the search or show all addresses.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#f7fafd] text-xs uppercase tracking-wide text-[#7892ad]">
                  <tr>
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3">Address</th>
                    <th className="px-5 py-3">Current Zone</th>
                    <th className="px-5 py-3">Assign Zone</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#edf3f8]">
                  {visibleAddresses.map((address) => (
                    <tr key={address.id}>
                      <td className="px-5 py-4">
                        <p className="font-medium text-[#17395d]">
                          {address.user?.name ?? "Unknown customer"}
                        </p>
                        <p className="mt-1 text-xs text-[#8aa0b5]">
                          {address.user?.email ?? "No email"}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-[#4f7192]">{address.address}</p>
                        {address.archived_at && <p className="mt-1 text-xs font-medium text-amber-800">Retained for an existing order · no longer a saved address</p>}
                        {address.label && (
                          <p className="mt-1 text-xs text-[#8aa0b5]">
                            {address.label}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {address.delivery_zone ? (
                          <span className="rounded-full bg-[#e8f3fc] px-2.5 py-1 text-xs font-medium text-[#28618e]">
                            {address.delivery_zone.name}
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                            Unassigned
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <select
                          aria-label={`Delivery zone for ${address.user?.name || "customer"} at ${address.address}`}
                          value={address.delivery_zone_id ?? ""}
                          disabled={
                            assigningAddressId === address.id ||
                            activeZones.length === 0
                          }
                          onChange={(event) => {
                            const zoneId = Number(event.target.value);

                            if (zoneId) {
                              assignAddress(address.id, zoneId);
                            }
                          }}
                          className="min-w-40 rounded-lg border border-[#cfdeeb] bg-white px-3 py-2 text-sm text-[#4f7192] outline-none disabled:opacity-50"
                        >
                          <option value="">Select zone</option>

                          {activeZones.map((zone) => (
                            <option key={zone.id} value={zone.id}>
                              {zone.name}
                            </option>
                          ))}
                        </select>

                        {assigningAddressId === address.id && (
                          <p className="mt-1 text-xs text-[#7892ad]">
                            Saving...
                          </p>
                        )}
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
      <p className="mt-2 text-2xl font-semibold text-[#17395d]">{value}</p>
    </div>
  );
}