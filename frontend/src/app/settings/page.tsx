"use client";

import { FormEvent, useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";

type Service = {
  id: number;
  name: string;
  pricing_type: "per_kg" | "fixed";
  rate: string | number;
  is_active: boolean;
};

type ServiceForm = {
  name: string;
  pricing_type: "per_kg" | "fixed";
  rate: string;
  is_active: boolean;
};

const API_URL = "http://127.0.0.1:8000/api";

export default function SettingsPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState<ServiceForm>({
    name: "",
    pricing_type: "per_kg",
    rate: "",
    is_active: true,
  });

  useEffect(() => {
    async function loadServices() {
      const token = localStorage.getItem("washease_token");

      if (!token) {
        setError("Authentication token not found.");
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/staff/services`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(
            `Unable to load services (${response.status}).`
          );
        }

        const data = await response.json();
        setServices(Array.isArray(data) ? data : []);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Unable to load services."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadServices();
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm({
      name: "",
      pricing_type: "per_kg",
      rate: "",
      is_active: true,
    });
  }

  function editService(service: Service) {
    setEditingId(service.id);
    setForm({
      name: service.name,
      pricing_type: service.pricing_type,
      rate: String(service.rate),
      is_active: service.is_active,
    });
    setError("");
    setSuccess("");
  }

  async function saveService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = localStorage.getItem("washease_token");

    if (!token) {
      setError("Authentication token not found.");
      return;
    }

    const rate = Number(form.rate);

    if (!form.name.trim()) {
      setError("Service name is required.");
      return;
    }

    if (Number.isNaN(rate) || rate < 0) {
      setError("Rate must be zero or greater.");
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      const isEditing = editingId !== null;

      const response = await fetch(
        isEditing
          ? `${API_URL}/staff/services/${editingId}`
          : `${API_URL}/staff/services`,
        {
          method: isEditing ? "PUT" : "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: form.name.trim(),
            pricing_type: form.pricing_type,
            rate,
            is_active: form.is_active,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ?? `Unable to save service (${response.status}).`
        );
      }

      const saved: Service = data.service;

      setServices((current) => {
        const exists = current.some((service) => service.id === saved.id);

        return exists
          ? current.map((service) =>
              service.id === saved.id ? saved : service
            )
          : [...current, saved].sort((a, b) =>
              a.name.localeCompare(b.name)
            );
      });

      setSuccess(
        isEditing
          ? "Service updated successfully."
          : "Service created successfully."
      );

      resetForm();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to save service."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AdminShell title="Settings">
      <div className="mx-auto max-w-7xl space-y-6">
        <p className="text-sm text-[#6f89a3]">
          Configure laundry services and pricing used when customers create
          bookings.
        </p>

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

        <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="overflow-hidden rounded-2xl border border-[#dbe7f3] bg-white">
            <div className="border-b border-[#e3edf6] px-5 py-4">
              <h2 className="font-semibold text-[#17395d]">
                Laundry Services
              </h2>
              <p className="mt-1 text-xs text-[#8098ae]">
                Active services are available in customer booking.
              </p>
            </div>

            {isLoading ? (
              <p className="p-5 text-sm text-[#7892ad]">
                Loading services...
              </p>
            ) : services.length === 0 ? (
              <p className="p-5 text-sm text-[#7892ad]">
                No services configured.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#f7fafd] text-xs uppercase tracking-wide text-[#7892ad]">
                    <tr>
                      <th className="px-5 py-3">Service</th>
                      <th className="px-5 py-3">Pricing</th>
                      <th className="px-5 py-3">Rate</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#edf3f8]">
                    {services.map((service) => (
                      <tr key={service.id}>
                        <td className="px-5 py-4 font-medium text-[#17395d]">
                          {service.name}
                        </td>

                        <td className="px-5 py-4 text-[#5e7891]">
                          {service.pricing_type === "per_kg"
                            ? "Per kilogram"
                            : "Fixed"}
                        </td>

                        <td className="px-5 py-4 text-[#17395d]">
                          ₱{Number(service.rate).toFixed(2)}
                          {service.pricing_type === "per_kg" ? "/kg" : ""}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              service.is_active
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {service.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => editService(service)}
                            className="rounded-lg border border-[#cfe0ef] px-3 py-1.5 text-xs font-medium text-[#28618e]"
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
            onSubmit={saveService}
            className="h-fit rounded-2xl border border-[#dbe7f3] bg-white p-5"
          >
            <h2 className="font-semibold text-[#17395d]">
              {editingId === null ? "Add Service" : "Edit Service"}
            </h2>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[#5e7891]">
                  Service name
                </span>

                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Example: Wash & Dry"
                  className="w-full rounded-lg border border-[#cfdeeb] px-3 py-2.5 text-sm outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[#5e7891]">
                  Pricing type
                </span>

                <select
                  value={form.pricing_type}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      pricing_type: event.target.value as
                        | "per_kg"
                        | "fixed",
                    }))
                  }
                  className="w-full rounded-lg border border-[#cfdeeb] bg-white px-3 py-2.5 text-sm"
                >
                  <option value="per_kg">Per kilogram</option>
                  <option value="fixed">Fixed price</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[#5e7891]">
                  Rate
                </span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.rate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      rate: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[#cfdeeb] px-3 py-2.5 text-sm outline-none"
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
                Active service
              </label>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg bg-[#173f66] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {isSaving
                  ? "Saving..."
                  : editingId === null
                    ? "Add Service"
                    : "Save Changes"}
              </button>

              {editingId !== null && (
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
      </div>
    </AdminShell>
  );
}