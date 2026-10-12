"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import AdminShell from "@/components/admin/AdminShell";
import WorkspaceIcon, { type IconName } from "@/components/WorkspaceIcon";

type Order = { id: number; order_number: string; status: string; weight: string | null; payment_status: string; delivery_run_id: number | null; user: { name: string }; address: { delivery_zone: { is_active: boolean } | null } | null };
type Rider = { id: number; name: string; availability: string; current_run: { id: number; total_load_kg: string; capacity_kg: string } | null };

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

  const queue = orders.map(order => ({ order, action: nextAction(order) })).filter(item => item.action);
  const filtered = queue.filter(({ order }) => `${order.order_number} ${order.user.name}`.toLowerCase().includes(search.trim().toLowerCase()));
  const ready = orders.filter(order => order.status === "Ready for Delivery" && !order.delivery_run_id).length;
  const cards: { label: string; value: number; href: string; icon: IconName; color: string }[] = [
    { label: "New bookings", value: orders.filter(order => order.status === "Pending").length, href: "/orders", icon: "orders", color: "bg-blue-50 text-blue-700" },
    { label: "In processing", value: orders.filter(order => order.status === "Processing").length, href: "/orders", icon: "settings", color: "bg-amber-50 text-amber-800" },
    { label: "Ready to assign", value: ready, href: "/deliveries", icon: "deliveries", color: "bg-emerald-50 text-emerald-800" },
    { label: "Awaiting rider return", value: riders.filter(rider => rider.availability === "Awaiting return").length, href: "/deliveries", icon: "return", color: "bg-violet-50 text-violet-800" },
  ];
  return <AdminShell title="Overview">
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-1 text-xs font-semibold uppercase tracking-widest text-blue-700">Staff workspace</p><h2 className="text-3xl font-bold tracking-tight">Your current workload</h2><p className="mt-2 text-sm text-slate-600">Confirm bookings, move laundry forward, and keep deliveries on track.</p></div><Link href="/customers" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700"><WorkspaceIcon name="plus" className="h-5 w-5" />New customer booking</Link></div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600"><p>{updatedAt ? `Last updated ${updatedAt} PHT · checks every 15 seconds while visible` : "Loading current orders and riders…"}</p><button type="button" onClick={() => setRevision(value => value + 1)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium">Refresh workspace</button></div>
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error} {updatedAt && "Previously loaded data remains visible and may be out of date."}<button type="button" onClick={() => setRevision(value => value + 1)} className="ml-3 font-semibold underline">Retry</button></div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(card => <Link key={card.label} href={card.href} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 hover:border-blue-300"><span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${card.color}`}><WorkspaceIcon name={card.icon} className="h-6 w-6" /></span><span><span className="block text-sm text-slate-600">{card.label}</span><strong className="mt-1 block text-3xl tracking-tight">{loading || (error && !updatedAt) ? "—" : card.value}</strong></span><span aria-hidden="true" className="ml-auto text-slate-400">›</span></Link>)}</div>
      <div className="grid items-start gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 p-5"><h3 className="text-lg font-semibold">Orders needing action</h3><Link href="/orders" className="text-sm font-semibold text-blue-700">View all orders →</Link></div><div className="px-5 pb-4"><label htmlFor="work-search" className="sr-only">Search the work queue by customer or order number</label><input id="work-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a customer or order number" className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm" /></div>
          {loading ? <p role="status" className="p-5 text-sm text-slate-600">Loading orders…</p> : error && !updatedAt ? <p className="p-5 text-sm text-slate-600">Order data unavailable. Retry above.</p> : !filtered.length ? <p className="p-5 text-sm text-slate-600">{search ? "No matching orders. Try another name or order number." : "No orders need action under these checks. Check Deliveries for active trips."}</p> : <ul className="divide-y divide-slate-100">{filtered.slice(0, 8).map(({ order, action }) => <li key={order.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"><div className="min-w-0"><p className="font-semibold">{order.user.name}</p><p className="mt-1 text-xs text-slate-500">{order.order_number}</p><span className="mt-2 inline-block rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{order.status}</span></div><Link href={action!.href} className="min-h-11 rounded-xl border border-blue-200 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50">{action!.label} →</Link></li>)}</ul>}
          {filtered.length > 8 && <p className="border-t border-slate-100 p-5 text-xs text-slate-600">Showing 8 of {filtered.length} matching orders. Open Orders for the complete list.</p>}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="text-lg font-semibold">Delivery workspace</h3><p className="mt-1 text-sm text-slate-600">{loading ? "Checking delivery readiness…" : `${ready} orders ready and unassigned`}</p><Link href="/deliveries" className="mt-4 flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">Plan and track delivery runs →</Link><div className="mt-5 space-y-3">{loading ? <p className="text-sm text-slate-600">Loading rider availability…</p> : !riders.length ? <p className="text-sm text-slate-600">{error ? "Rider data unavailable." : "No riders added yet."} <Link href="/riders" className="font-semibold text-blue-700">Open Riders</Link></p> : riders.slice(0, 5).map(rider => <article key={rider.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{rider.name}</strong><span className={`rounded-lg px-2 py-1 text-xs font-semibold ${rider.availability === "Available" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{rider.availability}</span></div>{rider.current_run && <p className="mt-2 text-xs text-slate-600">Run #{rider.current_run.id} · {rider.current_run.total_load_kg} / {rider.current_run.capacity_kg} kg</p>}<Link href={rider.availability === "Off duty" ? "/riders" : "/deliveries"} className="mt-3 inline-block py-1 text-sm font-semibold text-blue-700">{rider.availability === "Awaiting return" ? "Review and confirm return" : rider.availability === "Available" ? "Plan a delivery" : rider.availability === "Off duty" ? "Review duty status" : "View current trips"} →</Link></article>)}</div><Link href="/riders" className="mt-4 inline-block text-sm font-semibold text-blue-700">View all riders →</Link></section>
      </div>
      <p className="text-xs leading-5 text-slate-500">Counts show the current workload across all booking dates. Revenue and date-based summaries are available in <Link href="/reports" className="font-semibold text-blue-700">Reports</Link>.</p>
    </section>
  </AdminShell>;
}
