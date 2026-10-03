"use client";
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
export type DeliveryRun = { id: number; returned_at: string | null; status: string; capacity_kg: string; total_load_kg: string; max_orders: number; rider: { id: number; name: string; phone: string | null; rider_on_duty: boolean }; orders: { id: number }[] };
export default function DeliveryAssignment({ orderIds, selectedWeight, initialRiderId, onAssigned }: { orderIds: number[]; selectedWeight?: number; initialRiderId?: number; onAssigned: () => void }) {
  const [runs, setRuns] = useState<DeliveryRun[]>([]);
  const [riders, setRiders] = useState<{ id: number; name: string; availability: string }[]>([]);
  const [runId, setRunId] = useState("");
  const [riderId, setRiderId] = useState(initialRiderId ? String(initialRiderId) : "");
  const [mode, setMode] = useState("new");
  const [capacity, setCapacity] = useState("");
  const [maxOrders, setMaxOrders] = useState("20");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const headers = { Accept: "application/json", Authorization: `Bearer ${localStorage.getItem("washease_token")}` };
    Promise.all([fetch(`${API_URL}/staff/delivery-runs`, { headers }), fetch(`${API_URL}/staff/riders`, { headers })])
      .then(async ([a, b]) => { if (!a.ok || !b.ok) throw new Error("Unable to load riders and runs."); return Promise.all([a.json(), b.json()]); })
      .then(([a, b]) => { if (active) { setRuns(a); setRiders(b); } })
      .catch((e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
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
      onAssigned();
    } catch (e) { setError(e instanceof Error ? e.message : "Assignment failed."); } finally { setBusy(false); }
  }
  const field = "w-full rounded-lg border border-slate-300 p-2 text-sm";
  return <section className="space-y-3 rounded-xl border border-[#dbe7f3] p-4">
    <h4 className="font-semibold text-[#17395d]">2. Assign selected orders</h4>
    <p className="text-sm text-slate-600">{orderIds.length} orders selected{selectedWeight !== undefined ? ` · ${selectedWeight.toFixed(2)} kg` : ""}</p>
    {!orderIds.length && <p className="rounded-lg bg-blue-50 p-3 text-sm">Select the order checkboxes above before saving a delivery.</p>}
    <div className="flex flex-wrap gap-2">{[["new", "New delivery"], ["planned", "Add to planned run"]].map(([value, label]) => <button key={value} type="button" aria-pressed={mode === value} disabled={busy} onClick={() => { setMode(value); setRunId(""); setError(""); }} className={`rounded-lg border px-4 py-2 text-sm font-semibold ${mode === value ? "bg-[#17395d] text-white" : "bg-white text-slate-700"}`}>{label}</button>)}</div>
    {mode === "planned" && <label className="block text-sm">Planned run<select className={field} value={runId} disabled={busy} onChange={e => setRunId(e.target.value)}><option value="">Choose a run awaiting departure</option>{runs.filter(r => r.status === "Planned").map(r => <option key={r.id} value={r.id}>#{r.id} · {r.rider.name} · {r.orders.length}/{r.max_orders} orders · {r.total_load_kg}/{r.capacity_kg} kg</option>)}</select>{!runs.some(r => r.status === "Planned") && <span className="block text-slate-500">No planned runs. Choose New delivery.</span>}</label>}
    {mode === "new" && <div className="rounded-lg bg-emerald-50 p-3"><p className="mb-2 text-sm font-semibold text-emerald-900">Available riders</p><div className="flex flex-wrap gap-2">{riders.filter(r => r.availability === "Available").map(r => <button type="button" key={r.id} disabled={busy} aria-pressed={riderId === String(r.id)} onClick={() => setRiderId(String(r.id))} className={`rounded-lg border px-3 py-2 text-sm ${riderId === String(r.id) ? "bg-emerald-800 text-white" : "bg-white text-emerald-900"}`}>{r.name} · Available</button>)}</div>{!riders.some(r => r.availability === "Available") && <p className="text-sm text-emerald-900">No riders are currently available. Check duty status or confirm return from their last delivery.</p>}</div>}
    {mode === "new" && <div className="grid gap-3 sm:grid-cols-3">
      <label className="text-sm">Rider<select className={field} value={riderId} disabled={busy} onChange={e => setRiderId(e.target.value)}><option value="">Select rider</option>{riders.map(r => <option key={r.id} value={r.id}>{r.name} · {r.availability}</option>)}</select></label>
      <label className="text-sm">Vehicle capacity (kg)<input className={field} type="number" min="0.01" step="0.01" value={capacity} disabled={busy} onChange={e => setCapacity(e.target.value)} /></label>
      <label className="text-sm">Maximum orders<input className={field} type="number" min="1" max="1000" value={maxOrders} disabled={busy} onChange={e => setMaxOrders(e.target.value)} /></label>
    </div>}
    <p className="text-xs text-slate-500">Use the vehicle’s actual capacity. Creating a delivery plans a new trip; click Depart run separately when ready. Riders must be on duty and returned before departure.</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <button type="button" disabled={busy || !orderIds.length} onClick={assign} className="rounded-lg bg-[#299cdb] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving..." : mode === "new" ? "Create delivery with selected orders" : "Add selected orders to run"}</button>
  </section>;
}
