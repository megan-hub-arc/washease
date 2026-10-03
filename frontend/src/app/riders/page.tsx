"use client";

import { API_URL } from "@/lib/api";
import { useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";

type Rider = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  availability: string;
  rider_on_duty: boolean;
  current_run: { id: number } | null;
  planned_run_ids: number[];
};

export default function RidersPage() {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingContact, setSavingContact] = useState(false);
  const [success, setSuccess] = useState("");
  const [filter, setFilter] = useState("All");
  const [savingId, setSavingId] = useState<number | null>(null);
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

  async function saveContact(event: React.FormEvent) {
    event.preventDefault(); setError(""); setSuccess(""); setSavingContact(true);
    try {
      const headers = { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("washease_token")}` };
      const response = await fetch(`${API_URL}/staff/riders${editingId ? `/${editingId}` : ""}`, { method: editingId ? "PUT" : "POST", headers, body: JSON.stringify({ name: name.trim(), phone: phone.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(Object.values(data.errors ?? {}).flat().join(" ") || data.message || "Unable to save rider.");
      const refreshed = await fetch(`${API_URL}/staff/riders`, { headers });
      if (!refreshed.ok) throw new Error("Rider saved, but the list could not refresh. Reload this page before adding again.");
      setRiders(await refreshed.json()); setSuccess(data.message); setEditingId(null); setName(""); setPhone("");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save rider."); } finally { setSavingContact(false); }
  }
  async function updateDuty(rider: Rider) {
    setError(""); setSavingId(rider.id);
    try {
      const headers = { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("washease_token")}` };
      const response = await fetch(`${API_URL}/staff/riders/${rider.id}/duty`, { method: "PUT", headers, body: JSON.stringify({ rider_on_duty: !rider.rider_on_duty }) });
      if (!response.ok) throw new Error("Unable to update duty status.");
      const refreshed = await fetch(`${API_URL}/staff/riders`, { headers });
      if (!refreshed.ok) throw new Error("Unable to refresh riders.");
      setRiders(await refreshed.json());
    } catch (e) { setError(e instanceof Error ? e.message : "Duty update failed."); } finally { setSavingId(null); }
  }
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

        {success && <p role="status" className="rounded-lg bg-emerald-50 p-4 text-emerald-800">{success}</p>}
        <form id="rider-contact" onSubmit={saveContact} className="scroll-mt-24 rounded-xl border bg-white p-5"><h2 className="font-semibold">{editingId ? "Edit rider contact" : "Add rider"}</h2><p className="mt-2 text-sm text-slate-600">Record the name and work phone staff use for delivery coordination.</p><div className="mt-4 flex flex-wrap items-end gap-3"><label className="text-sm">Name<input required maxLength={255} disabled={savingContact} value={name} onChange={e => setName(e.target.value)} className="mt-1 block rounded-lg border p-3" /></label><label className="text-sm">Work phone<input type="tel" required maxLength={30} disabled={savingContact} value={phone} onChange={e => setPhone(e.target.value)} className="mt-1 block rounded-lg border p-3" /></label><button disabled={savingContact || savingId !== null} className="rounded-lg bg-[#17395d] px-4 py-3 text-white">{savingContact ? "Saving..." : editingId ? "Save contact" : "Add rider"}</button>{editingId && <button type="button" disabled={savingContact} onClick={() => { setEditingId(null); setName(""); setPhone(""); }} className="rounded-lg border px-4 py-3">Cancel</button>}</div></form>
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

        <div className="flex flex-wrap gap-2">{["All", "Available", "Assigned, awaiting departure", "Out on delivery", "Awaiting return", "Off duty"].map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-lg border px-3 py-2 text-sm ${filter === value ? "bg-[#17395d] text-white" : "bg-white"}`}>{value} · {riders.filter(rider => value === "All" || rider.availability === value).length}</button>)}</div>
        <a href="/deliveries" className="inline-block rounded-lg border px-4 py-2 font-semibold">Plan deliveries or confirm rider return →</a>
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
          ) : riders.filter(rider => filter === "All" || rider.availability === filter).length === 0 ? (
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
                    <th className="px-5 py-3">Availability / run</th><th className="px-5 py-3">Duty</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#edf3f8]">
                  {riders.filter(rider => filter === "All" || rider.availability === filter).map((rider) => (
                    <tr key={rider.id}>
                      <td className="px-5 py-4 font-medium text-[#17395d]">
                        {rider.name}
                      </td>

                      <td className="px-5 py-4 text-[#5e7891]">
                        {rider.email || "Not provided"}
                      </td>

                      <td className="px-5 py-4 text-[#5e7891]">
                        {rider.phone ?? "—"}
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full bg-[#e8f3fc] px-2.5 py-1 text-xs font-medium text-[#28618e]">
                          {rider.availability}
                        </span>
                        <p className="mt-2 text-xs">{rider.current_run ? `Current run #${rider.current_run.id}` : rider.planned_run_ids.length ? `Planned runs: ${rider.planned_run_ids.join(", ")}` : "No active run"}</p>
                      </td>
                      <td className="px-5 py-4"><button type="button" disabled={savingId !== null || savingContact} onClick={() => updateDuty(rider)} className="rounded-lg border px-3 py-2">{savingId === rider.id ? "Saving..." : rider.rider_on_duty ? "Mark off duty" : "Mark on duty"}</button><button type="button" disabled={savingContact} onClick={() => { setEditingId(rider.id); setName(rider.name); setPhone(rider.phone || ""); setSuccess(""); document.getElementById("rider-contact")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="mt-2 block rounded-lg border px-3 py-2">Edit contact</button></td>
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