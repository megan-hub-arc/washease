"use client";

import { useState } from "react";
import { API_URL } from "@/lib/api";

type AuditEntry = {
  id: number; actor_user_id: number; actor_name: string; actor_role: string;
  action: string; subject_type: string; subject_id: number; subject_label: string;
  before_values: Record<string, unknown>; after_values: Record<string, unknown>; created_at: string;
};
type AuditPage = { data: AuditEntry[]; current_page: number; last_page: number; total: number };
const actions: Record<string, string> = {
  order_status: "Order status", order_payment: "Payment", order_assignment: "Rider assignment",
  order_weight: "Weight and amount", order_requested_times: "Requested times", run_status: "Run status", run_return: "Rider return",
};
function displayValue(value: unknown): string {
  return value === null || value === undefined ? "Not set" : String(value);
}

export default function AuditHistory() {
  const [history, setHistory] = useState<AuditPage>();
  const [action, setAction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load(page = 1) {
    setBusy(true); setError("");
    try {
      const query = new URLSearchParams({ page: String(page), per_page: "20" });
      if (action) query.set("action", action);
      const response = await fetch(`${API_URL}/staff/audit-logs?${query}`, {
        signal: AbortSignal.timeout(15000),
        headers: { Accept: "application/json", Authorization: `Bearer ${localStorage.getItem("washease_token")}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load action history.");
      setHistory(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load action history."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
    <div><h2 className="font-semibold text-slate-900">Order and delivery action history</h2><p className="mt-1 text-sm text-slate-600">Staff and administrator changes to order status, payment, assignment, weight, requested times, and run departure/completion/return. Records begin after this feature is installed; older actions are not reconstructed.</p></div>
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm">Action<select value={action} disabled={busy} onChange={e => { setAction(e.target.value); setHistory(undefined); setError(""); }} className="mt-1 block rounded-lg border border-slate-300 p-2"><option value="">All recorded actions</option>{Object.entries(actions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button type="button" disabled={busy} onClick={() => void load()} className="min-h-11 rounded-lg border border-blue-300 px-4 text-sm font-semibold text-blue-800 disabled:opacity-50">{busy ? "Loading history…" : history ? "Refresh history" : "Load history"}</button>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {history && <div aria-live="polite" className="space-y-3">
      <p className="text-sm text-slate-600">{history.total} records · Page {history.current_page} of {history.last_page}</p>
      {!history.data.length && <p className="text-sm text-slate-600">No recorded actions match this filter.</p>}
      {history.data.map(entry => <article key={entry.id} className="space-y-2 rounded-xl border border-slate-200 p-4 text-sm">
        <div className="flex flex-wrap justify-between gap-2"><strong>{entry.subject_label} · {actions[entry.action] || entry.action}</strong><time dateTime={entry.created_at} className="text-slate-600">{new Date(entry.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} PHT</time></div>
        <p className="text-slate-600">{entry.actor_name} · {entry.actor_role} · User #{entry.actor_user_id}</p>
        <dl className="space-y-1">{Object.entries(entry.after_values).map(([field, value]) => <div key={field} className="flex flex-wrap gap-x-2"><dt className="font-medium">{field.replaceAll("_", " ")}:</dt><dd className="break-all">{displayValue(entry.before_values[field])} → {displayValue(value)}</dd></div>)}</dl>
      </article>)}
      <div className="flex gap-2"><button type="button" disabled={busy || history.current_page <= 1} onClick={() => void load(history.current_page - 1)} className="min-h-11 rounded-lg border px-4 text-sm disabled:opacity-50">Previous</button><button type="button" disabled={busy || history.current_page >= history.last_page} onClick={() => void load(history.current_page + 1)} className="min-h-11 rounded-lg border px-4 text-sm disabled:opacity-50">Next</button></div>
    </div>}
  </section>;
}
