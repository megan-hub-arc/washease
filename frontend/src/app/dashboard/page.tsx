"use client";

import LaundryIllustration from "@/components/LaundryIllustration";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { API_URL } from "@/lib/api";
import AdminShell from "@/components/admin/AdminShell";
import WorkspaceIcon, { type IconName } from "@/components/WorkspaceIcon";

type Order = { id: number; order_number: string; status: string; weight: string | null; payment_status: string; delivery_run_id: number | null; user: { name: string }; address: { delivery_zone: { is_active: boolean } | null } | null };
type Rider = { id: number; name: string; availability: string; current_run: { id: number; status: string; returned_at: string | null; total_load_kg: string; capacity_kg: string } | null };

function nextAction(order: Order) {
  const href = `/orders?order=${order.id}`;
  if (order.status === "Pending") return { label: "Confirm booking", href };
  if (["Picked Up", "Processing", "Ready for Delivery"].includes(order.status) && Number(order.weight || 0) <= 0) return { label: "Record weight", href };
  if (order.status === "Confirmed") return { label: "Record pickup", href };
  if (order.status === "Picked Up") return { label: "Start processing", href };
  if (order.status === "Processing") return { label: "Review progress", href };
  if (order.status === "Ready for Delivery" && !order.address?.delivery_zone?.is_active) return { label: "Check delivery zone", href };
  if (order.status === "Ready for Delivery" && !order.delivery_run_id) return { label: "Plan delivery", href: "/deliveries" };
  if (order.status === "Delivered" && order.payment_status === "Unpaid") return { label: "Review collection", href };
  return null;
}

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [updatedAt, setUpdatedAt] = useState("");
  const [search, setSearch] = useState("");
  const [returningId, setReturningId] = useState<number | null>(null);
  const returnInFlight = useRef(false);
  const [returnFeedback, setReturnFeedback] = useState("");
  const [returnError, setReturnError] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    let stopped = false;
    let inFlight = false;
    let controller: AbortController | undefined;
    async function load() {
      if (inFlight || document.hidden) return;
      inFlight = true;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 10000);
      try {
        const token = localStorage.getItem("washease_token");
        if (!token) throw new Error("Sign in to load your workspace.");
        const headers = { Accept: "application/json", Authorization: `Bearer ${token}` };
        const responses = await Promise.all([fetch(`${API_URL}/staff/orders`, { headers, signal: controller.signal }), fetch(`${API_URL}/staff/riders`, { headers, signal: controller.signal })]);
        if (responses.some(response => !response.ok)) throw new Error("Unable to refresh the workspace. Check your connection and retry.");
        const [newOrders, newRiders] = await Promise.all(responses.map(response => response.json()));
        if (!stopped) {
          setOrders(newOrders); setRiders(newRiders); setError("");
          setDate(new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }));
          setUpdatedAt(new Date().toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone: "Asia/Manila" }));
        }
      } catch (problem) {
        if (!stopped) setError(problem instanceof Error && problem.name !== "AbortError" ? problem.message : "Refresh timed out. Check your connection and retry.");
      } finally {
        window.clearTimeout(timeout); inFlight = false;
        if (!stopped) setLoading(false);
      }
    }
    void load();
    const timer = window.setInterval(() => { void load(); }, 15000);
    const resume = () => { void load(); };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => { stopped = true; controller?.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", resume); window.removeEventListener("online", resume); };
  }, [revision]);

  async function confirmRiderReturn(rider: Rider) {
    const run = rider.current_run;
    if (returnInFlight.current || !run || run.status !== "Completed" || run.returned_at) return;
    returnInFlight.current = true;
    setReturningId(rider.id); setReturnFeedback(""); setReturnError("");
    try {
      const response = await fetch(`${API_URL}/staff/delivery-runs/${run.id}/return`, {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${localStorage.getItem("washease_token")}` },
        signal: AbortSignal.timeout(10000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to confirm rider return.");
      setReturnFeedback(`Return confirmed for ${rider.name}. Refreshing availability…`);
    } catch (problem) {
      setReturnError(problem instanceof Error && !["TimeoutError", "AbortError"].includes(problem.name) ? problem.message : "The request timed out. Check the refreshed rider status before trying again; the return may already have saved.");
    } finally {
      // Reload even after network failure: the mutation may have reached the server.
      setLoading(true); setRevision(value => value + 1);
      setReturningId(null); returnInFlight.current = false;
    }
  }

  const queue = orders.map(order => ({ order, action: nextAction(order) })).filter(item => item.action);
  const filtered = queue.filter(({ order }) => `${order.order_number} ${order.user.name}`.toLowerCase().includes(search.trim().toLowerCase()));
  const ready = orders.filter(order => order.status === "Ready for Delivery" && !order.delivery_run_id).length;
  const cards: { label: string; value: number; href: string; icon: IconName; color: string }[] = [
    { label: "New bookings", value: orders.filter(order => order.status === "Pending").length, href: "/orders", icon: "orders", color: "bg-blue-50 text-blue-700" },
    { label: "In processing", value: orders.filter(order => order.status === "Processing").length, href: "/orders", icon: "settings", color: "bg-amber-50 text-amber-800" },
    { label: "Ready to assign", value: ready, href: "/deliveries", icon: "deliveries", color: "bg-emerald-50 text-emerald-800" },
    { label: "Awaiting rider return", value: riders.filter(rider => rider.availability === "Awaiting return").length, href: "/deliveries", icon: "return", color: "bg-violet-50 text-violet-800" },
  ];
  return <AdminShell title="Overview" headerContent={<div className="w-full"><label htmlFor="work-search" className="sr-only">Search the work queue by customer or order number</label><input id="work-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a customer or order number" className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm" /></div>}>
    <section className="space-y-6">
      <div className="laundry-welcome flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-4"><LaundryIllustration className="hidden h-28 w-40 sm:block" /><div><p className="mb-1 text-xs font-semibold uppercase tracking-widest text-blue-700">Overview</p><h2 className="text-3xl font-bold tracking-tight">Today’s work</h2><p className="mt-2 text-sm text-slate-600">{date || "Your laundry workspace"}</p></div></div><Link href="/customers" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700"><WorkspaceIcon name="plus" className="h-5 w-5" />New booking</Link></div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600"><p>{updatedAt ? `Last updated ${updatedAt} PHT · checks every 15 seconds while visible` : "Loading current orders and riders…"}</p><button type="button" onClick={() => setRevision(value => value + 1)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium">Refresh workspace</button></div>
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error} {updatedAt && "Previously loaded data remains visible and may be out of date."}<button type="button" onClick={() => setRevision(value => value + 1)} className="ml-3 font-semibold underline">Retry</button></div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(card => <Link key={card.label} href={card.href} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-300"><span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${card.color}`}><WorkspaceIcon name={card.icon} className="h-6 w-6" /></span><span><span className="block text-sm text-slate-600">{card.label}</span><strong className="mt-1 block text-3xl tracking-tight">{loading || (error && !updatedAt) ? "—" : card.value}</strong></span><span aria-hidden="true" className="ml-auto text-slate-400">›</span></Link>)}</div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 p-5"><h3 className="text-lg font-semibold">Orders needing action</h3><Link href="/orders" className="text-sm font-semibold text-blue-700">View all orders →</Link></div>
          {loading ? <p role="status" className="p-5 text-sm text-slate-600">Loading orders…</p> : error && !updatedAt ? <p className="p-5 text-sm text-slate-600">Order data unavailable. Retry above.</p> : !filtered.length ? <p className="p-5 text-sm text-slate-600">{search ? "No matching orders. Try another name or order number." : "No orders need action under these checks. Check Deliveries for active trips."}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm"><caption className="sr-only">Orders requiring staff attention and their next action</caption><thead className="border-y border-slate-100 bg-slate-50 text-xs text-slate-600"><tr><th scope="col" className="px-5 py-3 font-medium">Customer</th><th scope="col" className="px-3 py-3 font-medium">Status</th><th scope="col" className="px-5 py-3 font-medium">Next action</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.slice(0, 6).map(({ order, action }) => <tr key={order.id}><td className="px-5 py-4"><strong className="block font-semibold">{order.user.name}</strong><span className="mt-1 block text-xs text-slate-500">{order.order_number}</span></td><td className="px-3 py-4"><span className={`inline-block rounded-lg px-2 py-1 text-xs font-medium ${order.status === "Pending" ? "bg-amber-50 text-amber-800" : order.status === "Processing" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-800"}`}>{order.status}</span></td><td className="px-5 py-4"><Link href={action!.href} className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-4 text-xs font-semibold ${order.status === "Pending" ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-blue-200 text-blue-700 hover:bg-blue-50"}`}>{action!.label}</Link></td></tr>)}</tbody></table></div>}
          {filtered.length > 6 && <p className="border-t border-slate-100 p-5 text-xs text-slate-600">Showing 6 of {filtered.length} matching orders. Open Orders for the complete list.</p>}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="text-lg font-semibold">Delivery workspace</h3>{returnFeedback && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{returnFeedback}</p>}{returnError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{returnError}</p>}<p className="mt-1 text-sm text-slate-600">{loading ? "Checking delivery readiness…" : `${ready} orders ready and unassigned`}</p><Link href="/deliveries" className="mt-4 flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">Plan and track delivery runs →</Link><div className="mt-5 space-y-3">{loading ? <p className="text-sm text-slate-600">Loading rider availability…</p> : !riders.length ? <p className="text-sm text-slate-600">{error ? "Rider data unavailable." : "No riders added yet."} <Link href="/riders" className="font-semibold text-blue-700">Open Riders</Link></p> : [...riders].sort((a, b) => (b.availability === "Awaiting return" ? 2 : b.availability === "Out on delivery" ? 1 : 0) - (a.availability === "Awaiting return" ? 2 : a.availability === "Out on delivery" ? 1 : 0) || a.name.localeCompare(b.name)).slice(0, 3).map(rider => <article key={rider.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="min-w-0 break-words text-sm">{rider.name}</strong><span className={`rounded-lg px-2 py-1 text-xs font-semibold ${rider.availability === "Available" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{rider.availability}</span></div>{rider.current_run && <p className="mt-2 text-xs text-slate-600">Run #{rider.current_run.id} · {rider.current_run.total_load_kg} / {rider.current_run.capacity_kg} kg</p>}{rider.current_run && ["Started", "Completed"].includes(rider.current_run.status) && !rider.current_run.returned_at ? <div className="mt-3"><p id={`return-help-${rider.id}`} className="mb-2 text-xs leading-5 text-slate-600">{rider.current_run.status === "Started" ? "Finish all deliveries in this run before confirming return." : "Confirm only after the rider is physically back at the shop."}</p><button type="button" aria-describedby={`return-help-${rider.id}`} disabled={rider.current_run.status !== "Completed" || returningId !== null || !!error} onClick={() => { void confirmRiderReturn(rider); }} className="min-h-11 rounded-lg border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500">{returningId === rider.id ? "Confirming return…" : "Confirm rider returned"}</button></div> : <Link href={rider.availability === "Off duty" ? "/riders" : "/deliveries"} className="mt-3 inline-block py-1 text-sm font-semibold text-blue-700">{rider.availability === "Awaiting return" ? "Review and confirm return" : rider.availability === "Available" ? "Plan a delivery" : rider.availability === "Off duty" ? "Review duty status" : "View current trips"} →</Link>}</article>)}</div><Link href="/riders" className="mt-4 inline-block text-sm font-semibold text-blue-700">View all riders →</Link></section>
      </div>
      <p className="text-xs leading-5 text-slate-500">Counts show the current workload across all booking dates. Revenue and date-based summaries are available in <Link href="/reports" className="font-semibold text-blue-700">Reports</Link>.</p>
    </section>
  </AdminShell>;
}
