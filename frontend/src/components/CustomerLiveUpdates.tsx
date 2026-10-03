"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";
import { requestedTimeLabel } from "@/lib/requested-times";

type Notice = { id: string; read_at: string | null; created_at: string; data: { order_id: number; order_number: string; message: string } };

export default function CustomerLiveUpdates<T>({ onOrdersUpdated }: { onOrdersUpdated: (orders: T[]) => void }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notice[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState("");
  const [error, setError] = useState("");
  const [readError, setReadError] = useState("");
  const [readingId, setReadingId] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let controller: AbortController | null = null;
    let stopped = false;
    async function sync() {
      if (inFlight || disposed || stopped || document.visibilityState !== "visible") return;
      const token = localStorage.getItem("washease_token");
      if (!token) { stopped = true; router.replace("/"); return; }
      inFlight = true;
      controller = new AbortController();
      const activeController = controller;
      const timeout = window.setTimeout(() => activeController.abort(), 10000);
      try {
        const headers = { Accept: "application/json", Authorization: `Bearer ${token}` };
        const [ordersResponse, notificationsResponse] = await Promise.all([
          fetch(`${API_URL}/orders`, { headers, signal: controller.signal, cache: "no-store" }),
          fetch(`${API_URL}/customer/notifications?page=${page}`, { headers, signal: controller.signal, cache: "no-store" }),
        ]);
        if (ordersResponse.status === 401 || notificationsResponse.status === 401) {
          stopped = true; localStorage.removeItem("washease_token"); localStorage.removeItem("washease_user"); router.replace("/"); return;
        }
        if (!ordersResponse.ok || !notificationsResponse.ok) throw new Error("Automatic updates could not connect. Previously loaded information is still shown.");
        const [orders, notices] = await Promise.all([ordersResponse.json(), notificationsResponse.json()]);
        if (disposed) return;
        onOrdersUpdated(orders as T[]);
        setNotifications(notices.notifications); setUnreadCount(notices.unread_count); setLastPage(notices.last_page);
        setLastSynced(new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", second: "2-digit" }).format(new Date()));
        setError("");
      } catch (error) {
        if (!disposed) setError(activeController.signal.aborted ? "The update check timed out. Previously loaded information is still shown." : error instanceof Error ? error.message : "Automatic updates failed. Retrying while this page is open.");
      } finally {
        window.clearTimeout(timeout);
        inFlight = false;
        if (!disposed) setLoading(false);
      }
    }
    const visible = () => { if (document.visibilityState === "visible") void sync(); };
    const online = () => { void sync(); };
    void sync();
    const interval = window.setInterval(() => { void sync(); }, 15000);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("online", online);
    return () => { disposed = true; controller?.abort(); window.clearInterval(interval); document.removeEventListener("visibilitychange", visible); window.removeEventListener("online", online); };
  }, [onOrdersUpdated, page, revision, router]);

  async function markRead(id: string) {
    setReadingId(id); setReadError("");
    try {
      const response = await fetch(`${API_URL}/customer/notifications/${id}/read`, { method: "PUT", headers: { Accept: "application/json", Authorization: `Bearer ${localStorage.getItem("washease_token")}` } });
      if (response.status === 401) { localStorage.removeItem("washease_token"); localStorage.removeItem("washease_user"); router.replace("/"); return; }
      if (!response.ok) throw new Error("Could not mark this notification as read. Try again.");
      setNotifications(current => current.map(notice => notice.id === id ? { ...notice, read_at: new Date().toISOString() } : notice));
      setRevision(value => value + 1);
    } catch (error) { setReadError(error instanceof Error ? error.message : "Could not mark notification as read."); }
    finally { setReadingId(null); }
  }

  function openOrder(id: number) {
    const target = document.getElementById(`customer-order-${id}`);
    if (target) { target.scrollIntoView({ behavior: "smooth", block: "center" }); target.focus({ preventScroll: true }); }
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-lg font-semibold text-slate-900">Order updates <span className="text-sm font-normal text-slate-600">{unreadCount} unread</span></h3><p className="mt-1 text-xs text-slate-600">Orders and updates refresh every 15 seconds while this page is visible.{lastSynced ? ` Last checked: ${lastSynced} PHT.` : " Checking for updates…"}</p></div>
      <button type="button" disabled={loading} onClick={() => { setLoading(true); setRevision(value => value + 1); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-blue-600">Check now</button>
    </div>
    {error && <p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error} We retry every 15 seconds.</p>}
    {readError && <p role="alert" className="mt-3 text-sm text-red-700">{readError}</p>}
    <details className="mt-4">
      <summary className="cursor-pointer text-sm font-semibold text-blue-800">View saved notifications</summary>
      {loading ? <p className="mt-3 text-sm text-slate-600">Loading updates…</p> : !notifications.length ? <p className="mt-3 text-sm text-slate-600">No notifications yet. New bookings and staff updates will appear here.</p> : <ul className="mt-3 space-y-3">{notifications.map(notice => <li key={notice.id} className={`rounded-xl border p-4 ${notice.read_at ? "border-slate-200" : "border-blue-200 bg-blue-50"}`}>
        <p className="text-sm font-semibold text-slate-900">{notice.data.order_number}{!notice.read_at && <span className="ml-2 text-xs text-blue-800">Unread</span>}</p><p className="mt-1 text-sm text-slate-700">{notice.data.message}</p><p className="mt-2 text-xs text-slate-600">{requestedTimeLabel(notice.created_at)}</p>
        <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => { window.dispatchEvent(new CustomEvent("washease:show-customer-order", { detail: notice.data.order_id })); window.setTimeout(() => openOrder(notice.data.order_id), 0); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">View order</button>{!notice.read_at && <button type="button" disabled={readingId !== null} onClick={() => markRead(notice.id)} className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm disabled:opacity-50">{readingId === notice.id ? "Saving…" : "Mark as read"}</button>}</div>
      </li>)}</ul>}
      {lastPage > 1 && <div className="mt-4 flex items-center gap-3"><button type="button" disabled={page === 1} onClick={() => setPage(value => value - 1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Newer</button><span className="text-xs">Page {page} of {lastPage}</span><button type="button" disabled={page >= lastPage} onClick={() => setPage(value => value + 1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Older</button></div>}
    </details>
  </section>;
}
