"use client";

import { useEffect, useState, type FormEvent } from "react";
import RequestedTimeFields from "@/components/RequestedTimeFields";
import { requestTimestamp } from "@/lib/requested-times";
import { API_URL } from "@/lib/api";

export type IntakeCustomer = {
  id: number; name: string; email: string | null; phone: string | null;
  addresses: { id: number; label: string | null; address: string; delivery_zone: { id: number; name: string; priority_order: number; is_active: boolean } | null }[];
  orders: { id: number; order_number: string; status: string; payment_status: string; total_amount: string | number | null }[];
};
type Service = { id: number; name: string; pricing_type: string; rate: string };
const input = "mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-blue-600 disabled:bg-slate-100";
const button = "rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50";
const blankAddress = { label: "Home", address: "", zone: "", notes: "" };

export default function StaffCustomerIntake({ customers, onSaved }: { customers: IntakeCustomer[]; onSaved: (customer: IntakeCustomer) => void }) {
  const [mode, setMode] = useState<"customer" | "order" | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [profile, setProfile] = useState({ name: "", phone: "", email: "", password: "", password_confirmation: "" });
  const [address, setAddress] = useState(blankAddress);
  const [addingAddress, setAddingAddress] = useState(false);
  const [addressId, setAddressId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [preference, setPreference] = useState("Cash");
  const [requestedTimes, setRequestedTimes] = useState({ pickup: "", delivery: "" });
  const [notes, setNotes] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [serviceError, setServiceError] = useState("");
  const [serviceRevision, setServiceRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createdOrder, setCreatedOrder] = useState<{ id: number; order_number: string } | null>(null);
  const customer = customers.find(item => String(item.id) === customerId);
  const service = services.find(item => String(item.id) === serviceId);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/services`, { signal: controller.signal, headers: { Accept: "application/json", Authorization: `Bearer ${localStorage.getItem("washease_token")}` } })
      .then(async response => { if (!response.ok) throw new Error("Could not load services. Retry before creating an order."); return response.json(); })
      .then(data => { setServices(Array.isArray(data) ? data : []); setServiceError(""); })
      .catch(error => { if (!controller.signal.aborted) setServiceError(error.message); });
    return () => controller.abort();
  }, [serviceRevision]);

  async function send(path: string, body: object) {
    const response = await fetch(`${API_URL}${path}`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("washease_token")}` }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(response.status === 401 ? "Your session expired. Sign in again." : data.errors ? Object.values(data.errors).flat().join(" ") : data.message || "Could not save. Try again.");
    return data;
  }

  async function register(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage(""); setCreatedOrder(null);
    try {
      const data = await send("/staff/customers", { ...profile, ...address });
      onSaved(data.customer); setCustomerId(String(data.customer.id)); setAddressId(String(data.customer.addresses[0].id));
      setProfile({ name: "", phone: "", email: "", password: "", password_confirmation: "" }); setAddress(blankAddress); setMode("order");
      setMessage("Customer and address saved. Give the customer their sign-in phone and initial password privately. You can create their first order below.");
    } catch (error) { setError(error instanceof Error ? error.message : "Could not register customer."); }
    finally { setBusy(false); }
  }

  async function saveAddress(event: FormEvent) {
    event.preventDefault(); if (!customer) return; setBusy(true); setError(""); setMessage("");
    try {
      const data = await send(`/staff/customers/${customer.id}/addresses`, address);
      onSaved({ ...customer, addresses: [...customer.addresses, data.address] }); setAddressId(String(data.address.id)); setAddingAddress(false); setAddress(blankAddress);
      setMessage("Address saved. Staff must assign its delivery zone before scheduling.");
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save address."); }
    finally { setBusy(false); }
  }

  async function createOrder(event: FormEvent) {
    event.preventDefault(); if (!customer) return; setBusy(true); setError(""); setMessage(""); setCreatedOrder(null);
    try {
      const data = await send(`/staff/customers/${customer.id}/orders`, { address_id: Number(addressId), service_id: Number(serviceId), payment_preference: preference, notes, pickup_requested_at: requestTimestamp(requestedTimes.pickup), delivery_requested_at: requestTimestamp(requestedTimes.delivery) });
      onSaved({ ...customer, orders: [data.order, ...customer.orders] }); setCreatedOrder(data.order); setNotes(""); setRequestedTimes({ pickup: "", delivery: "" }); setMode(null);
      setMessage(`Order ${data.order.order_number} created for ${customer.name}. Continue in Manage Order to record weight and processing progress.`);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not create order."); }
    finally { setBusy(false); }
  }

  function addressFields() {
    return <div className="grid gap-4 md:grid-cols-2">
      <label className="text-sm font-medium">Address label<input disabled={busy} maxLength={50} className={input} value={address.label} onChange={event => setAddress({ ...address, label: event.target.value })} placeholder="Home or work" /></label>
      <label className="text-sm font-medium">Area or barangay (optional)<input disabled={busy} maxLength={100} className={input} value={address.zone} onChange={event => setAddress({ ...address, zone: event.target.value })} /></label>
      <label className="text-sm font-medium md:col-span-2">Complete pickup / delivery address<textarea disabled={busy} required maxLength={500} className={input} value={address.address} onChange={event => setAddress({ ...address, address: event.target.value })} placeholder="House number, street, barangay and city" /></label>
      <label className="text-sm font-medium md:col-span-2">Address instructions (optional)<textarea disabled={busy} maxLength={500} className={input} value={address.notes} onChange={event => setAddress({ ...address, notes: event.target.value })} placeholder="Landmark or meeting point" /></label>
    </div>;
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-semibold text-slate-900">Book for a customer</h2><p className="mt-1 text-sm text-slate-600">For customers at the counter or booking by phone. Search existing records before registering someone new.</p></div><div className="flex gap-2">
      <button type="button" disabled={busy} className={button} aria-expanded={mode === "customer"} onClick={() => { setMode("customer"); setError(""); setMessage(""); setCreatedOrder(null); }}>Register customer</button>
      <button type="button" disabled={busy} className={`${button} bg-blue-600 text-white`} aria-expanded={mode === "order"} onClick={() => { setMode("order"); setError(""); setMessage(""); setCreatedOrder(null); }}>Create order</button>
    </div></div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    {createdOrder && <a href={`/orders?order=${createdOrder.id}`} className="mt-3 inline-block rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Manage {createdOrder.order_number} →</a>}
    {mode === "customer" && <form onSubmit={register} className="mt-5 space-y-4">
      <h3 className="font-semibold">1. Customer details</h3><div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium">Full name<input disabled={busy} required maxLength={255} className={input} value={profile.name} onChange={event => setProfile({ ...profile, name: event.target.value })} /></label>
        <label className="text-sm font-medium">Phone for contact and sign in<input disabled={busy} type="tel" required pattern="\+?[0-9]{7,15}" title="Use 7–15 digits, optionally starting with +, without spaces or dashes." className={input} value={profile.phone} onChange={event => setProfile({ ...profile, phone: event.target.value })} placeholder="09123456789" /></label>
        <label className="text-sm font-medium md:col-span-2">Email (optional)<input disabled={busy} type="email" maxLength={255} className={input} value={profile.email} onChange={event => setProfile({ ...profile, email: event.target.value })} /></label>
        <label className="text-sm font-medium">Initial password<input disabled={busy} type="password" autoComplete="new-password" minLength={8} required className={input} value={profile.password} onChange={event => setProfile({ ...profile, password: event.target.value })} /></label>
        <label className="text-sm font-medium">Confirm initial password<input disabled={busy} type="password" autoComplete="new-password" minLength={8} required className={input} value={profile.password_confirmation} onChange={event => setProfile({ ...profile, password_confirmation: event.target.value })} /></label>
      </div><p className="text-sm text-slate-600">Use at least 8 characters. The customer can sign in using their phone or email and change their password in Edit profile.</p>
      <h3 className="font-semibold">2. Save their address</h3>{addressFields()}
      <div className="flex gap-2"><button disabled={busy} className={`${button} bg-blue-600 text-white`}>{busy ? "Saving…" : "Save customer and address"}</button><button type="button" disabled={busy} className={button} onClick={() => setMode(null)}>Cancel</button></div>
    </form>}
    {mode === "order" && <div className="mt-5 space-y-4">
      <label className="block text-sm font-medium">Customer<select disabled={busy} className={input} value={customerId} onChange={event => { setCustomerId(event.target.value); setAddressId(""); setAddingAddress(false); setAddress(blankAddress); setError(""); setMessage(""); }}><option value="">Choose an existing customer</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name} · {customer.phone || customer.email || "No contact"}</option>)}</select></label>
      {customer && <>
        {!addingAddress && <button type="button" disabled={busy} className={button} onClick={() => { setAddingAddress(true); setAddress(blankAddress); }}>Add address for {customer.name}</button>}
        {addingAddress ? <form onSubmit={saveAddress} className="space-y-4 rounded-xl border p-4"><h3 className="font-semibold">New address for {customer.name}</h3>{addressFields()}<div className="flex gap-2"><button disabled={busy} className={button}>{busy ? "Saving…" : "Save address"}</button><button type="button" disabled={busy} className={button} onClick={() => setAddingAddress(false)}>Cancel</button></div></form> : <form onSubmit={createOrder} className="space-y-4">
          <label className="block text-sm font-medium">Pickup / delivery address<select required disabled={busy} className={input} value={addressId} onChange={event => setAddressId(event.target.value)}><option value="">Choose address</option>{customer.addresses.map(address => <option key={address.id} value={address.id}>{address.label || "Address"}: {address.address}</option>)}</select></label>
          {!customer.addresses.length && <p className="text-sm text-amber-800">Save an address before creating this order.</p>}
          {serviceError && <p role="alert" className="text-sm text-red-700">{serviceError} <button type="button" className="underline" onClick={() => setServiceRevision(value => value + 1)}>Retry services</button></p>}
          {!serviceError && services.length === 0 && <p className="text-sm text-amber-800">No active services are available. Add or activate a service in Settings before booking.</p>}
          <div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium">Laundry service<select required disabled={busy} className={input} value={serviceId} onChange={event => setServiceId(event.target.value)}><option value="">Choose service</option>{services.map(service => <option key={service.id} value={service.id}>{service.name} · ₱{Number(service.rate).toFixed(2)} {service.pricing_type === "per_kg" ? "per kg" : "per order"}</option>)}</select></label>
          <label className="text-sm font-medium">Preferred payment method<select disabled={busy} className={input} value={preference} onChange={event => setPreference(event.target.value)}><option>Cash</option><option>GCash</option></select></label></div>
          <RequestedTimeFields value={requestedTimes} onChange={setRequestedTimes} disabled={busy} />
          <label className="block text-sm font-medium">Laundry instructions (optional)<textarea disabled={busy} maxLength={500} className={input} value={notes} onChange={event => setNotes(event.target.value)} /></label>
          <p className="text-sm text-slate-600">{service?.pricing_type === "fixed" ? `Order charge: ₱${Number(service.rate).toFixed(2)}.` : "Final charge is calculated after staff records the laundry weight."} Payment remains unpaid until staff records an actual collection.</p>
          <div className="flex gap-2"><button disabled={busy || !addressId || !serviceId || !!serviceError} className={`${button} bg-blue-600 text-white`}>{busy ? "Creating…" : `Create order for ${customer.name}`}</button><button type="button" disabled={busy} className={button} onClick={() => setMode(null)}>Cancel</button></div>
        </form>}
      </>}
    </div>}
  </section>;
}
