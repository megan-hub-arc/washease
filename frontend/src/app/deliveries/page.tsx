"use client";
import { useCallback, useEffect, useState } from "react";
import { requestedTimeLabel } from "@/lib/requested-times";
import { API_URL } from "@/lib/api";
import RiderRunLink, { type CreatedRiderLink } from "@/components/admin/RiderRunLink";
import AdminShell from "@/components/admin/AdminShell";
import DeliveryAssignment, { type DeliveryRun } from "@/components/admin/DeliveryAssignment";
type Order = { delivery_requested_at: string | null; id: number; order_number: string; status: string; delivery_status: string; delivery_sequence: number | null; weight: string | null; delivery_run_id: number | null; delivery_run: DeliveryRun | null; user: { name: string }; address: { address: string; delivery_zone: { name: string; is_active: boolean } | null } | null };
type BatchPreview = { batches: { zone_id: number; zone_name: string; orders: { id: number; order_number: string; weight: number }[]; total_load_kg: number }[]; overweight: { id: number; order_number: string; weight: number; zone_name: string }[] };
export default function DeliveriesPage() {
  const [batchCapacity, setBatchCapacity] = useState("");
  const [batchLimit, setBatchLimit] = useState("20");
  const [batchPreview, setBatchPreview] = useState<BatchPreview | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchError, setBatchError] = useState("");
  const [batchSelection, setBatchSelection] = useState<{ capacity: string; limit: string; revision: number }>();
  const [createdLink, setCreatedLink] = useState<CreatedRiderLink>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [runs, setRuns] = useState<DeliveryRun[]>([]);
  const [runFilter, setRunFilter] = useState("All");
  const [selected, setSelected] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initialRiderId, setInitialRiderId] = useState<number>();
  const [revision, setRevision] = useState(0);
  const load = useCallback(async () => {
    const headers = { Accept: "application/json", Authorization: `Bearer ${localStorage.getItem("washease_token")}` };
    try {
      const [a, b] = await Promise.all([fetch(`${API_URL}/staff/orders`, { headers }), fetch(`${API_URL}/staff/delivery-runs`, { headers })]);
      if (!a.ok || !b.ok) throw new Error("Unable to load delivery data.");
      const [orderData, runData] = await Promise.all([a.json(), b.json()]);
      setBatchPreview(null); setBatchSelection(undefined); setInitialRiderId(undefined); setOrders(orderData); setRuns(runData); setSelected([]); setRevision(value => value + 1);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load deliveries."); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  async function mutate(path: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`${API_URL}${path}`, { method: "POST", headers: { Accept: "application/json", Authorization: `Bearer ${localStorage.getItem("washease_token")}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Delivery update failed.");
      setMessage(data.message || "Delivery updated.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Delivery update failed."); } finally { setBusy(false); }
  }
  async function previewBatches() {
    setBatchBusy(true); setBatchError(""); setBatchPreview(null);
    try {
      const query = new URLSearchParams({ capacity_kg: batchCapacity, max_orders: batchLimit });
      const response = await fetch(`${API_URL}/staff/orders/batch-preview?${query}`, { signal: AbortSignal.timeout(15000), headers: { Accept: "application/json", Authorization: `Bearer ${localStorage.getItem("washease_token")}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to preview batches.");
      setBatchPreview(data);
    } catch (e) { setBatchError(e instanceof Error ? e.message : "Unable to preview batches."); }
    finally { setBatchBusy(false); }
  }
  const waiting = orders.filter(o => o.status === "Ready for Delivery" && o.delivery_status === "Unscheduled");
  const scheduled = orders.filter(o => o.status === "Ready for Delivery" && o.delivery_status === "Scheduled").sort((a, b) => (a.delivery_sequence ?? 999999) - (b.delivery_sequence ?? 999999) || a.id - b.id);
  return <AdminShell title="Deliveries"><section className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
      ["Needs review", waiting.length, "Check missing inputs or refresh an older ready record."],
      ["Awaiting departure", runs.filter(run => run.status === "Planned" && !run.returned_at).length, "Review the load, then depart the run."],
      ["On the road", runs.filter(run => run.status === "Started" && !run.returned_at).length, "Update delivered orders in Manage Order."],
      ["Awaiting return", runs.filter(run => run.status === "Completed" && !run.returned_at).length, "Confirm return to make the rider available."],
    ].map(([label, count, detail]) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm font-medium text-slate-600">{label}</p><strong className="mt-2 block text-2xl">{loading ? "—" : count}</strong><p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p></article>)}</div>
    {createdLink && <RiderRunLink key={`created-${createdLink.runId}`} runId={createdLink.runId} initial={createdLink} />}
    <h3 className="text-lg font-semibold">1. Review the automatic delivery queue</h3>
    <p className="text-sm text-slate-500">{waiting.length} need preparation · {scheduled.length} prioritized orders</p>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-800">{message}</p>}
    <p className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950">Ready orders enter the queue automatically when weight and an active zone are recorded. Priority also updates when an unassigned order’s weight, requested time, or zone changes. Select orders below to assign a rider.</p><details className="rounded-lg border bg-white p-3 text-sm"><summary className="cursor-pointer text-slate-600">Queue recovery</summary><p className="mt-2 text-slate-600">If an older ready order has not entered the queue, refresh its priorities here. Assigned runs stay unchanged.</p><button disabled={busy || !orders.some(order => order.status === "Ready for Delivery" && !order.delivery_run_id)} onClick={() => mutate("/staff/orders/schedule")} className="mt-3 min-h-11 rounded-lg border px-4 font-semibold text-blue-800 disabled:opacity-50">Refresh unassigned priorities</button></details>
    <p className="text-xs text-slate-500">Priority: zone first, earliest requested delivery time within the zone, then heavier load for matching times. Orders without a requested delivery time come last within their zone. A positive weight and active zone are required. Rebuilding the queue preserves assigned runs.</p>
    {waiting.length > 0 && <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer text-sm font-semibold">Needs preparation · {waiting.length} orders</summary><div className="mt-3 space-y-2">{waiting.map(order => <a key={order.id} href={`/orders?order=${order.id}&section=details`} className="block rounded-lg border p-3 text-sm"><strong>{order.order_number}</strong> · {order.user.name}<p>{Number(order.weight) > 0 ? `${order.weight} kg` : "Record weight"} · {order.address?.delivery_zone?.is_active ? order.address.delivery_zone.name : "Assign an active delivery zone"}</p><p>Requested delivery: {requestedTimeLabel(order.delivery_requested_at)}</p><span className="font-semibold">Open order →</span></a>)}</div></details>}
    {loading ? <p>Loading deliveries...</p> : <div className="space-y-2">{scheduled.filter(order => !order.delivery_run || order.delivery_run.status === "Planned").map(order => <label key={order.id} className="flex items-start gap-3 rounded-xl border border-[#e2e8f0] bg-white p-4">
      <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-blue-600" disabled={busy || (!!order.delivery_run && order.delivery_run.status !== "Planned")} checked={selected.includes(order.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, order.id] : ids.filter(id => id !== order.id))} />
      <span className="text-sm"><strong>#{order.delivery_sequence} · {order.order_number} · {order.user.name}</strong><span className="block">{order.weight || "Weight missing"} kg · {order.address?.address}</span><span className="block text-slate-600">{order.address?.delivery_zone?.name || "Zone unavailable"} · Requested delivery: {requestedTimeLabel(order.delivery_requested_at)}</span><span className="block text-slate-500">{order.delivery_run ? `${order.delivery_run.rider.name} · Run #${order.delivery_run.id} (${order.delivery_run.status})` : "No rider assigned"}</span></span>
    </label>)}{!scheduled.length && <p className="rounded-xl bg-white p-5 text-slate-500">No prioritized ready orders.</p>}</div>}
    <section className="space-y-3 rounded-xl border border-blue-200 bg-white p-4">
      <h4 className="font-semibold">Suggest batches by vehicle capacity</h4>
      <p className="text-sm text-slate-600">Prioritized unassigned ready orders only. Each zone stays separate, following ZTLPA priority. Selecting a batch fills the existing assignment form below; it does not create a run.</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Vehicle capacity (kg)<input type="number" min="0.01" max="999999.99" step="0.01" disabled={batchBusy} value={batchCapacity} onChange={e => { setBatchCapacity(e.target.value); setBatchPreview(null); }} className="mt-1 block w-44 rounded-lg border p-2" /></label>
        <label className="text-sm">Maximum orders per run<input type="number" min="1" max="1000" step="1" disabled={batchBusy} value={batchLimit} onChange={e => { setBatchLimit(e.target.value); setBatchPreview(null); }} className="mt-1 block w-44 rounded-lg border p-2" /></label>
        <button type="button" disabled={busy || loading || batchBusy || !batchCapacity || Number(batchCapacity) <= 0 || !Number.isInteger(Number(batchLimit)) || Number(batchLimit) < 1 || Number(batchLimit) > 1000} onClick={previewBatches} className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{batchBusy ? "Checking batches…" : "Preview batches"}</button>
      </div>
      {batchError && <p role="alert" className="text-sm text-red-700">{batchError}</p>}
      {batchPreview && <div className="space-y-3" aria-live="polite">
        <p className="text-sm text-slate-600">{batchPreview.batches.length} suggested batches. No runs have been created. Availability is checked again when you save.</p>
        {batchPreview.batches.map((batch, index) => <article key={`${batch.zone_id}-${index}`} className="rounded-lg border p-3">
          <strong className="text-sm">Batch {index + 1} · {batch.zone_name} · {batch.orders.length} orders · {batch.total_load_kg.toFixed(2)} / {Number(batchCapacity).toFixed(2)} kg</strong>
          <p className="my-2 text-sm text-slate-600">{batch.orders.map(order => `${order.order_number} (${order.weight.toFixed(2)} kg)`).join(" → ")}</p>
          <button type="button" disabled={busy || batchBusy || batch.orders.some(item => !orders.some(order => order.id === item.id && order.status === "Ready for Delivery" && !order.delivery_run_id))} onClick={() => { setSelected(batch.orders.map(order => order.id)); setBatchSelection({ capacity: batchCapacity, limit: batchLimit, revision: (batchSelection?.revision ?? 0) + 1 }); setMessage(`Batch ${index + 1} selected. Choose a rider and review the assignment below.`); document.getElementById("delivery-assignment")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="min-h-11 rounded-lg border border-blue-300 px-4 text-sm font-semibold text-blue-800 disabled:opacity-50">Select this batch</button>
        </article>)}
        {batchPreview.overweight.map(order => <p key={order.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{order.order_number} · {order.zone_name} · {order.weight.toFixed(2)} kg exceeds vehicle capacity. Excluded from suggestions; use a suitable vehicle.</p>)}
        {!batchPreview.batches.length && !batchPreview.overweight.length && <p className="text-sm text-slate-600">No eligible unassigned ready orders. Check weight and active delivery zone in Orders; use Queue recovery for an older unscheduled record.</p>}
      </div>}
    </section>
    <div id="delivery-assignment"><DeliveryAssignment key={`${revision}-${initialRiderId ?? ""}-${batchSelection?.revision ?? 0}`} initialCapacity={batchSelection?.capacity} initialMaxOrders={batchSelection?.limit} initialRiderId={initialRiderId} onRiderLink={setCreatedLink} selectedWeight={Math.round(orders.filter(o => selected.includes(o.id)).reduce((sum, o) => sum + Number(o.weight || 0), 0) * 100) / 100} orderIds={selected} onAssigned={() => { void load(); }} /></div>
    <h3 className="text-lg font-semibold">3. Track trips and confirm return</h3>
    <div className="flex flex-wrap gap-2">{[["All", "All active trips"], ["Planned", "Awaiting departure"], ["Started", "Out on delivery"], ["Completed", "Awaiting return"]].map(([value, label]) => <button key={value} type="button" aria-pressed={runFilter === value} onClick={() => setRunFilter(value)} className={`rounded-lg border px-4 py-2 text-sm ${runFilter === value ? "bg-blue-600 text-white" : "bg-white text-slate-700"}`}>{label} · {runs.filter(run => !run.returned_at && (value === "All" || run.status === value)).length}</button>)}</div>
    {!runs.some(run => !run.returned_at && (runFilter === "All" || run.status === runFilter)) && <p className="rounded-lg bg-white p-4 text-sm text-slate-600">No trips in this stage.</p>}
    {runs.filter(run => !run.returned_at && (runFilter === "All" || run.status === runFilter)).map(run => <article key={run.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e2e8f0] bg-white p-4"><div><strong>Run #{run.id} · {run.rider.name}</strong><p className="text-xs text-slate-500">Duty: {run.rider.rider_on_duty ? "On duty" : "Off duty"} · {run.status === "Started" ? "Out on delivery" : run.status === "Completed" && !run.returned_at ? "Awaiting return" : run.status === "Planned" ? "Awaiting departure" : "Return confirmed"}</p><p className="text-sm text-slate-500">{run.status === "Completed" ? (run.returned_at ? "Returned" : "Deliveries finished · awaiting return") : run.status} · {run.orders.length}/{run.max_orders} orders · {run.total_load_kg}/{run.capacity_kg} kg</p></div>{run.status === "Planned" && <button disabled={busy || !run.orders.length} onClick={() => mutate(`/staff/delivery-runs/${run.id}/start`)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">Depart run</button>}{run.status === "Completed" && !run.returned_at && <button disabled={busy} onClick={() => mutate(`/staff/delivery-runs/${run.id}/return`)} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-50">Confirm rider returned</button>}{["Planned", "Started"].includes(run.status) && <RiderRunLink runId={run.id} />}</article>)}
    <details className="rounded-xl border border-[#e2e8f0] bg-white p-4"><summary className="cursor-pointer font-semibold text-[#0f172a]">Delivery history · {runs.filter(run => run.returned_at).length} returned runs</summary><div className="mt-4 space-y-3">{runs.filter(run => run.returned_at).map(run => <article key={run.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-4"><div><strong>Run #{run.id} · {run.rider.name}</strong><p className="text-sm text-slate-600">Return confirmed · {run.orders.length} orders · {run.total_load_kg} kg</p></div><button type="button" disabled={busy || !run.rider.rider_on_duty || runs.some(other => other.rider.id === run.rider.id && ["Started", "Completed"].includes(other.status) && !other.returned_at)} onClick={() => { setInitialRiderId(run.rider.id); document.getElementById("delivery-assignment")?.scrollIntoView({ behavior: "smooth", block: "center" }); }} className="rounded-lg border border-[#0f172a] px-4 py-2 text-sm font-semibold text-[#0f172a] disabled:opacity-50">Plan next delivery with {run.rider.name}</button></article>)}</div></details>
  </section></AdminShell>;
}
