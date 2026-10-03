"use client";

import { useState, type FormEvent } from "react";
import { API_URL } from "@/lib/api";
import { requestTimestamp, requestedTimeInput, requestedTimeLabel } from "@/lib/requested-times";
import RequestedTimeFields from "@/components/RequestedTimeFields";

type TimingOrder = { id: number; status: string; delivery_run_id: number | null; pickup_requested_at: string | null; delivery_requested_at: string | null };
export default function OrderRequestedTimes({ order, onSaved }: { order: TimingOrder; onSaved: (order: unknown) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState({ pickup: requestedTimeInput(order.pickup_requested_at), delivery: requestedTimeInput(order.delivery_requested_at) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const locked = order.status === "Delivered" || order.delivery_run_id !== null;
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`${API_URL}/staff/orders/${order.id}/requested-times`, { method: "PUT", headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("washease_token")}` }, body: JSON.stringify({ pickup_requested_at: requestTimestamp(value.pickup), delivery_requested_at: requestTimestamp(value.delivery) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.errors ? Object.values(data.errors).flat().join(" ") : data.message || "Could not update requested times.");
      onSaved(data.order); setEditing(false); setMessage(data.message);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not update requested times."); }
    finally { setBusy(false); }
  }
  return <div className="mt-4 rounded-xl border border-slate-200 p-4">
    <p className="text-sm"><strong>Requested pickup:</strong> {requestedTimeLabel(order.pickup_requested_at)}</p>
    <p className="mt-1 text-sm"><strong>Requested delivery:</strong> {requestedTimeLabel(order.delivery_requested_at)}</p>
    <p className="mt-2 text-xs text-slate-600">Delivery priority uses the requested delivery time within each zone. These are customer requests, not confirmed appointments.</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}{message && <p role="status" className="mt-3 text-sm text-green-800">{message}</p>}
    {locked ? <p className="mt-3 text-xs text-slate-600">Requested times are locked after rider assignment or delivery.</p> : editing ? <form onSubmit={save} className="mt-4 space-y-3">
      <RequestedTimeFields value={value} onChange={setValue} disabled={busy} />
      <p className="text-xs text-amber-800">Saving clears this order’s previous delivery priority. Schedule it again in Deliveries before assigning a rider.</p>
      <div className="flex gap-2"><button disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">{busy ? "Saving…" : "Save requested times"}</button><button type="button" disabled={busy} onClick={() => setEditing(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button></div>
    </form> : <button type="button" onClick={() => { setValue({ pickup: requestedTimeInput(order.pickup_requested_at), delivery: requestedTimeInput(order.delivery_requested_at) }); setEditing(true); setMessage(""); }} className="mt-3 rounded-lg border px-4 py-2 text-sm font-semibold">Edit requested times</button>}
  </div>;
}
