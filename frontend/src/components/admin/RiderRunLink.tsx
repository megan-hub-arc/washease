"use client";

import { useEffect, useRef, useState } from "react";
import { API_URL } from "@/lib/api";

export type CreatedRiderLink = { runId: number; url?: string; expires_at?: string; error?: string };

export default function RiderRunLink({ runId, initial }: { runId: number; initial?: CreatedRiderLink }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [minutes, setMinutes] = useState("240");
  const [link, setLink] = useState(initial?.url ?? "");
  const [expires, setExpires] = useState(initial?.expires_at ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initial?.error ?? "");
  const [message, setMessage] = useState("");
  const [replace, setReplace] = useState(false);
  useEffect(() => { if (initial && !dialog.current?.open) dialog.current?.showModal(); }, [initial]);

  async function updateAccess(revoke = false) {
    dialog.current?.showModal();
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`${API_URL}/staff/delivery-runs/${runId}/rider-link`, {
        method: revoke ? "DELETE" : "POST",
        signal: AbortSignal.timeout(15000),
        headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("washease_token")}` },
        ...(revoke ? {} : { body: JSON.stringify({ expires_in_minutes: Number(minutes) }) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to update rider access.");
      if (!revoke && (typeof data.url !== "string" || !data.url)) throw new Error("The server did not return a rider link. Ask support to check the backend response.");
      setLink(revoke ? "" : data.url); setExpires(revoke ? "" : data.expires_at);
      setMessage(revoke ? "Rider access revoked." : "Rider link generated. Copy it below and send it privately to the assigned rider.");
      setReplace(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to generate the link. Try again."); }
    finally { setBusy(false); }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(link); setMessage("Copied. Send this link privately to the assigned rider."); }
    catch { setMessage("Select the link field and copy it manually."); }
  }
  return <div className="w-full rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm">
    <p className="font-semibold text-blue-950">Rider link · Run #{runId}</p>
    <p className="mt-1 text-slate-600">The assigned rider opens this private link without an account.</p>
    <button type="button" disabled={busy} onClick={() => { if (link) dialog.current?.showModal(); else void updateAccess(); }} className="mt-3 min-h-11 rounded-lg bg-blue-700 px-4 font-semibold text-white disabled:opacity-50">{link ? "Show and copy rider link" : "Generate rider link"}</button>
    <button type="button" onClick={() => dialog.current?.showModal()} className="ml-2 mt-3 min-h-11 rounded-lg border bg-white px-4 font-semibold text-blue-800">Manage access</button>
    <p className="mt-2 text-xs text-slate-600">Generating a new link replaces previous rider access for this run.</p>
    <dialog ref={dialog} aria-label={`Rider link for run ${runId}`} className="m-auto max-h-[90vh] w-[min(94vw,36rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-950/50">
      <div className="flex items-start justify-between gap-4"><h2 className="text-xl font-bold">Rider link · Run #{runId}</h2><button type="button" onClick={() => dialog.current?.close()} className="min-h-11 rounded-lg border px-3" aria-label="Close rider link">Close</button></div>
      {busy && <p role="status" className="mt-4 rounded-lg bg-blue-50 p-4">Updating rider access…</p>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}
      {link && <div className="mt-4 space-y-3 rounded-xl border border-green-200 bg-green-50 p-4"><p className="font-semibold">Your rider link is ready</p><label className="block font-medium">Private link<input aria-label={`Private rider link for run ${runId}`} readOnly value={link} onFocus={e => e.currentTarget.select()} className="mt-2 block min-h-12 w-full rounded-lg border bg-white p-3 text-sm" /></label><p>Expires {new Date(expires).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} PHT</p><button type="button" onClick={() => { void copyLink(); }} className="min-h-12 w-full rounded-lg bg-blue-700 px-4 font-semibold text-white">Copy rider link</button><p className="text-sm">Send it only to the assigned rider. Do not claim it yourself. Delivery confirmation unlocks after staff departs the run.</p></div>}
      {message && <p role="status" className="mt-3 text-sm text-blue-900">{message}</p>}
      <details className="mt-5 rounded-lg border p-3"><summary className="cursor-pointer font-semibold">Manage or replace access</summary><label className="mt-3 block">Duration<select value={minutes} onChange={e => setMinutes(e.target.value)} disabled={busy} className="ml-3 min-h-11 rounded-lg border px-3"><option value="60">1 hour</option><option value="240">4 hours</option><option value="480">8 hours</option><option value="720">12 hours</option></select></label><label className="mt-3 flex gap-2"><input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} /><span>I understand that replacing access stops the previous link and rider session.</span></label><button type="button" disabled={busy || !replace} onClick={() => { void updateAccess(); }} className="mt-3 min-h-11 rounded-lg bg-blue-700 px-4 font-semibold text-white disabled:opacity-50">Generate replacement link</button><button type="button" disabled={busy} onClick={() => { void updateAccess(true); }} className="ml-2 mt-3 min-h-11 rounded-lg border px-4 text-red-700 disabled:opacity-50">Revoke access</button></details>
      {!link && !busy && <button type="button" onClick={() => { void updateAccess(); }} className="mt-4 min-h-11 rounded-lg bg-blue-700 px-4 font-semibold text-white">Generate rider link</button>}
    </dialog>
  </div>;
}
