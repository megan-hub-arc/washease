"use client";
import { useEffect, useState } from "react";
import type { CreatedRiderLink } from "@/components/admin/RiderRunLink";
import { API_URL } from "@/lib/api";
export type DeliveryRun = { id: number; returned_at: string | null; status: string; capacity_kg: string; total_load_kg: string; max_orders: number; rider: { id: number; name: string; phone: string | null; rider_on_duty: boolean }; orders: { id: number }[] };
export default function DeliveryAssignment({ orderIds, selectedWeight, initialRiderId, initialCapacity, initialMaxOrders, onAssigned, onRiderLink }: { orderIds: number[]; selectedWeight?: number; initialRiderId?: number; initialCapacity?: string; initialMaxOrders?: string; onAssigned: () => void; onRiderLink?: (result: CreatedRiderLink) => void }) {
  const [runs, setRuns] = useState<DeliveryRun[]>([]);
  const [riders, setRiders] = useState<{ id: number; name: string; availability: string }[]>([]);
  const [runId, setRunId] = useState("");
  const [riderId, setRiderId] = useState(initialRiderId ? String(initialRiderId) : "");
  const [mode, setMode] = useState("new");
  const [capacity, setCapacity] = useState(initialCapacity ?? "");
  const [maxOrders, setMaxOrders] = useState(initialMaxOrders ?? "20");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const headers = { Accept: "application/json", Authorization: `Bearer ${localStorage.getItem("washease_token")}` };
    Promise.all([fetch(`${API_URL}/staff/delivery-runs`, { headers, signal: controller.signal }), fetch(`${API_URL}/staff/riders`, { headers, signal: controller.signal })])
      .then(async ([a, b]) => { if (!a.ok || !b.ok) throw new Error("Unable to load riders and runs."); return Promise.all([a.json(), b.json()]); })
      .then(([a, b]) => { if (active) { setRuns(a); setRiders(b); } })
      .catch((e: Error) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [revision]);
  async function assign() {
    setBusy(true); setError("");
    try {
      if (!orderIds.length) throw new Error("Select at least one scheduled order.");
      if (mode === "planned" && !runId) throw new Error("Choose a planned run first.");
      if (!runId && !riderId) throw new Error("Choose a rider from Available riders or the Rider dropdown.");
      if (!runId && (!capacity.trim() || !Number.isFinite(Number(capacity)) || Number(capacity) <= 0)) throw new Error("Enter the vehicle’s actual capacity in kg.");
      if (!runId && (!Number.isInteger(Number(maxOrders)) || Number(maxOrders) < 1 || Number(maxOrders) > 1000)) throw new Error("Maximum orders must be a whole number from 1 to 1000.");
      if (!runId && selectedWeight !== undefined && selectedWeight > Number(capacity)) throw new Error(`Selected weight is ${selectedWeight.toFixed(2)} kg; vehicle capacity is ${Number(capacity).toFixed(2)} kg. Remove orders or use a vehicle with enough capacity.`);
      if (!runId && orderIds.length > Number(maxOrders)) throw new Error("Selected orders exceed the maximum orders per run.");
      const response = await fetch(`${API_URL}/staff/delivery-runs${runId ? `/${runId}/orders` : ""}`, {
        method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("washease_token")}` },
        body: JSON.stringify(runId ? { order_ids: orderIds } : { rider_id: Number(riderId), capacity_kg: Number(capacity), max_orders: Number(maxOrders), order_ids: orderIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Assignment failed.");
      if (!runId && onRiderLink && data.delivery_run?.id) {
        const createdId = data.delivery_run.id as number;
        try {
          const linkResponse = await fetch(`${API_URL}/staff/delivery-runs/${createdId}/rider-link`, {
            method: "POST", signal: AbortSignal.timeout(15000),
            headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("washease_token")}` },
            body: JSON.stringify({ expires_in_minutes: 240 }),
          });
          const access = await linkResponse.json();
          if (!linkResponse.ok || !access.url) throw new Error(access.message || "Unable to create rider access.");
          onRiderLink({ runId: createdId, url: access.url, expires_at: access.expires_at });
        } catch (e) {
          onRiderLink({ runId: createdId, error: `Run created successfully, but its link could not be generated. ${e instanceof Error ? e.message : "Try generating it again."}` });
        }
      }
      onAssigned();
    } catch (e) { setError(e instanceof Error ? e.message : "Assignment failed."); } finally { setBusy(false); }
  }
  const chosenRider = riders.find(rider => String(rider.id) === riderId);
  const guidance: Record<string, string> = {
    "Available": "This rider is available. Create the run, then depart it when ready.",
    "Awaiting return": "Their deliveries are finished, but return has not been confirmed. You can plan ahead; confirm return in Deliveries before departure.",
    "Out on delivery": "This rider is still on a trip. You can plan ahead; finish their current deliveries and confirm return before departure.",
    "Off duty": "This rider is off duty. You can plan ahead; update duty in Riders before departure.",
    "Assigned, awaiting departure": "This rider already has a planned run. Use Add to planned run to combine orders, or plan a separate later trip.",
  };
  const saveBlocked = busy || loading || !orderIds.length || (mode === "planned" ? !runId : !riderId || !capacity.trim() || !Number.isFinite(Number(capacity)) || Number(capacity) <= 0 || !Number.isInteger(Number(maxOrders)) || Number(maxOrders) < 1 || Number(maxOrders) > 1000 || (selectedWeight !== undefined && selectedWeight > Number(capacity)) || orderIds.length > Number(maxOrders));
  const field = "w-full rounded-lg border border-slate-300 p-2 text-sm";
  return <section className="space-y-3 rounded-xl border border-[#e2e8f0] p-4">
    <h4 className="font-semibold text-[#0f172a]">2. Assign selected orders</h4>
    <p className="text-sm text-slate-600">{orderIds.length} orders selected{selectedWeight !== undefined ? ` · ${selectedWeight.toFixed(2)} kg` : ""}</p>
    {!orderIds.length && <p className="rounded-lg bg-blue-50 p-3 text-sm">Select the order checkboxes above before saving a delivery.</p>}
    <div className="flex flex-wrap gap-2">{[["new", "New delivery"], ["planned", "Add to planned run"]].map(([value, label]) => <button key={value} type="button" aria-pressed={mode === value} disabled={busy} onClick={() => { setMode(value); setRunId(""); setError(""); }} className={`rounded-lg border px-4 py-2 text-sm font-semibold ${mode === value ? "bg-blue-600 text-white" : "bg-white text-slate-700"}`}>{label}</button>)}</div>
    {mode === "planned" && <label className="block text-sm">Planned run<select className={field} value={runId} disabled={busy} onChange={e => setRunId(e.target.value)}><option value="">Choose a run awaiting departure</option>{runs.filter(r => r.status === "Planned").map(r => <option key={r.id} value={r.id}>#{r.id} · {r.rider.name} · {r.orders.length}/{r.max_orders} orders · {r.total_load_kg}/{r.capacity_kg} kg</option>)}</select>{!runs.some(r => r.status === "Planned") && <span className="block text-slate-500">No planned runs. Choose New delivery.</span>}</label>}
    {loading && <p role="status" className="text-sm text-slate-600">Checking riders and planned runs…</p>}
    {mode === "new" && !loading && <div className="rounded-lg bg-emerald-50 p-3"><p className="mb-2 text-sm font-semibold text-emerald-900">Available riders</p><div className="flex flex-wrap gap-2">{riders.filter(r => r.availability === "Available").map(r => <button type="button" key={r.id} disabled={busy} aria-pressed={riderId === String(r.id)} onClick={() => setRiderId(String(r.id))} className={`rounded-lg border px-3 py-2 text-sm ${riderId === String(r.id) ? "bg-emerald-800 text-white" : "bg-white text-emerald-900"}`}>{r.name} · Available</button>)}</div>{!riders.some(r => r.availability === "Available") && <p className="text-sm text-emerald-900">No rider is available to depart now. Choose a rider below to see what must happen next; planning ahead is still allowed.</p>}</div>}
    {mode === "new" && <div className="grid gap-3 sm:grid-cols-3">
      <label className="text-sm">Rider<select className={field} value={riderId} disabled={busy} onChange={e => setRiderId(e.target.value)}><option value="">Select rider</option>{riders.map(r => <option key={r.id} value={r.id}>{r.name} · {r.availability}</option>)}</select></label>
      <label className="text-sm">Vehicle capacity (kg)<input className={field} type="number" min="0.01" step="0.01" value={capacity} disabled={busy} onChange={e => setCapacity(e.target.value)} /></label>
      <label className="text-sm">Maximum orders<input className={field} type="number" min="1" max="1000" value={maxOrders} disabled={busy} onChange={e => setMaxOrders(e.target.value)} /></label>
    </div>}
    {mode === "new" && chosenRider && <p role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"><strong>{chosenRider.name} · {chosenRider.availability}</strong><span className="mt-1 block">{guidance[chosenRider.availability] || "Check this rider’s status in Riders before departure."}</span></p>}
    {mode === "new" && orderIds.length > 0 && <p className="text-sm text-slate-600">{!riderId ? "Next: choose a rider." : !capacity.trim() || !Number.isFinite(Number(capacity)) || Number(capacity) <= 0 ? "Next: enter a positive vehicle capacity in kilograms." : selectedWeight !== undefined && selectedWeight > Number(capacity) ? "Selected weight exceeds capacity. Remove orders or choose a suitable vehicle." : orderIds.length > Number(maxOrders) ? "Selected orders exceed the run limit. Remove orders or adjust the limit." : "Review the load and maximum orders, then save the planned run."}</p>}
    <p className="text-xs text-slate-500">Use the vehicle’s actual capacity. Creating a delivery plans a new trip; click Depart run separately when ready. Riders must be on duty and returned before departure.</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}<button type="button" disabled={busy || loading} onClick={() => { setLoading(true); setError(""); setRevision(value => value + 1); }} className="ml-3 font-semibold underline">Refresh riders and runs</button></p>}
    <button type="button" disabled={saveBlocked} onClick={assign} className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving..." : mode === "new" ? "Create delivery with selected orders" : "Add selected orders to run"}</button>
  </section>;
}
