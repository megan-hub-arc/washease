"use client";

import { useState, type FormEvent } from "react";
import { API_URL } from "@/lib/api";

type Customer = { id: number; name: string; email: string | null; phone: string | null; role: string };
type Address = { id: number; label: string | null; address: string; zone: string | null; notes: string | null; delivery_zone_id: number | null };
const emptyAddress = { label: "Home", address: "", zone: "", notes: "" };
const inputClass = "mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600";
const buttonClass = "rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50";

export default function CustomerAccount({ user, addresses, onProfileSaved, onAddressesSaved }: {
  user: Customer; addresses: Address[]; onProfileSaved: (user: Customer) => void; onAddressesSaved: (addresses: Address[]) => void;
}) {
  const [panel, setPanel] = useState<"profile" | "addresses" | null>(null);
  const [profile, setProfile] = useState({ name: user.name, email: user.email ?? "", phone: user.phone ?? "" });
  const [passwords, setPasswords] = useState({ current_password: "", password: "", password_confirmation: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [addressForm, setAddressForm] = useState(emptyAddress);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [removeId, setRemoveId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function request(path: string, method: string, body?: object) {
    const response = await fetch(`${API_URL}${path}`, {
      method, headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${localStorage.getItem("washease_token")}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) {
      const details = data.errors ? Object.values(data.errors).flat().join(" ") : data.message;
      throw new Error(response.status === 401 ? "Your session expired. Sign out and sign in again." : details || "Could not save. Please try again.");
    }
    return data;
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const data = await request("/customer/profile", "PUT", { ...profile, ...(passwords.password ? passwords : {}) });
      localStorage.setItem("washease_user", JSON.stringify(data.user));
      onProfileSaved(data.user); setPasswords({ current_password: "", password: "", password_confirmation: "" }); setMessage("Profile saved. Use your updated email or phone and password the next time you sign in.");
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save profile."); }
    finally { setBusy(false); }
  }

  async function saveAddress(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const data = await request(editingId ? `/addresses/${editingId}` : "/addresses", editingId ? "PUT" : "POST", addressForm);
      onAddressesSaved(editingId ? addresses.map(address => address.id === editingId ? data.address : address) : [data.address, ...addresses]);
      setShowAddressForm(false); setEditingId(null); setAddressForm(emptyAddress);
      setMessage("Address saved for future bookings. Existing orders keep their original address.");
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save address."); }
    finally { setBusy(false); }
  }

  async function removeAddress(id: number) {
    setBusy(true); setError(""); setMessage("");
    try {
      await request(`/addresses/${id}`, "DELETE");
      onAddressesSaved(addresses.filter(address => address.id !== id)); setRemoveId(null);
      setMessage("Saved address removed. Existing orders keep their original address.");
    } catch (error) { setError(error instanceof Error ? error.message : "Could not remove address."); }
    finally { setBusy(false); }
  }

  return <section id="customer-account" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-lg font-semibold text-slate-900">Your account</h3><p className="text-sm text-slate-600">Keep your contact details and pickup addresses up to date.</p></div>
      <div className="flex gap-2"><button type="button" disabled={busy} className={buttonClass} aria-expanded={panel === "profile"} onClick={() => { setPanel(panel === "profile" ? null : "profile"); setError(""); setMessage(""); }}>Edit profile</button>
        <button type="button" disabled={busy} className={buttonClass} aria-expanded={panel === "addresses"} onClick={() => { setPanel(panel === "addresses" ? null : "addresses"); setError(""); setMessage(""); }}>Manage addresses ({addresses.length})</button></div>
    </div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    {panel === "profile" && <form onSubmit={saveProfile} className="mt-5 space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-sm font-medium text-slate-700">Full name<input required maxLength={255} autoComplete="name" className={inputClass} disabled={busy} value={profile.name} onChange={event => setProfile({ ...profile, name: event.target.value })} /></label>
        <label className="text-sm font-medium text-slate-700">Email for sign in (optional)<input type="email" maxLength={255} autoComplete="email" className={inputClass} disabled={busy} value={profile.email} onChange={event => setProfile({ ...profile, email: event.target.value })} /></label>
        <label className="text-sm font-medium text-slate-700">Phone number<input type="tel" pattern="\+?[0-9]{7,15}" title="Use 7–15 digits, optionally starting with +, without spaces or dashes." autoComplete="tel" className={inputClass} disabled={busy} value={profile.phone} onChange={event => setProfile({ ...profile, phone: event.target.value })} /></label>
      </div>
      <p className="text-sm text-slate-600">Keep an email or phone number so you can sign in. Leave the password fields blank to keep your current password.</p>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-sm font-medium text-slate-700">Current password<input type="password" autoComplete="current-password" required={!!passwords.password} className={inputClass} disabled={busy} value={passwords.current_password} onChange={event => setPasswords({ ...passwords, current_password: event.target.value })} /></label>
        <label className="text-sm font-medium text-slate-700">New password<input type="password" autoComplete="new-password" minLength={8} className={inputClass} disabled={busy} value={passwords.password} onChange={event => setPasswords({ ...passwords, password: event.target.value })} /></label>
        <label className="text-sm font-medium text-slate-700">Confirm new password<input type="password" autoComplete="new-password" required={!!passwords.password} className={inputClass} disabled={busy} value={passwords.password_confirmation} onChange={event => setPasswords({ ...passwords, password_confirmation: event.target.value })} /></label>
      </div><button disabled={busy} className={`${buttonClass} bg-blue-600 text-white`}>{busy ? "Saving…" : "Save profile"}</button>
    </form>}
    {panel === "addresses" && <div className="mt-5 space-y-4">
      <p className="text-sm text-slate-600">Changes apply to future bookings. Contact staff to change the address of an existing order.</p>
      {!showAddressForm && <button type="button" disabled={busy} className={buttonClass} onClick={() => { setEditingId(null); setAddressForm(emptyAddress); setRemoveId(null); setShowAddressForm(true); }}>Add address</button>}
      {addresses.length === 0 && <p className="text-sm text-slate-600">Add your first address to book a pickup.</p>}
      {!showAddressForm && addresses.map(address => <article key={address.id} className="rounded-xl border border-slate-200 p-4">
        <h4 className="font-semibold text-slate-900">{address.label || "Pickup address"}</h4><p className="text-sm text-slate-700">{address.address}</p>
        {address.zone && <p className="text-sm text-slate-600">{address.zone}</p>}{address.notes && <p className="text-sm text-slate-600">Instructions: {address.notes}</p>}
        <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy} className={buttonClass} aria-label={`Edit ${address.label || address.address}`} onClick={() => { setEditingId(address.id); setAddressForm({ label: address.label ?? "", address: address.address, zone: address.zone ?? "", notes: address.notes ?? "" }); setRemoveId(null); setShowAddressForm(true); }}>Edit</button>
          <button type="button" disabled={busy} className={buttonClass} aria-label={`Remove ${address.label || address.address}`} onClick={() => setRemoveId(address.id)}>Remove</button></div>
        {removeId === address.id && <div className="mt-3 rounded-xl bg-slate-50 p-3"><p className="mb-2 text-sm">Remove this saved address? It will no longer be available for new bookings.</p><div className="flex gap-2"><button type="button" disabled={busy} className={buttonClass} onClick={() => removeAddress(address.id)}>Confirm removal</button><button type="button" disabled={busy} className={buttonClass} onClick={() => setRemoveId(null)}>Cancel</button></div></div>}
      </article>)}
      {showAddressForm && <form onSubmit={saveAddress} className="space-y-4 rounded-xl border border-slate-200 p-4">
        <h4 className="font-semibold">{editingId ? "Edit saved address" : "New pickup address"}</h4>
        <label className="block text-sm font-medium text-slate-700">Label (optional)<input maxLength={50} className={inputClass} disabled={busy} value={addressForm.label} onChange={event => setAddressForm({ ...addressForm, label: event.target.value })} placeholder="Home or work" /></label>
        <label className="block text-sm font-medium text-slate-700">Complete pickup address<textarea required maxLength={500} autoComplete="street-address" className={inputClass} disabled={busy} value={addressForm.address} onChange={event => setAddressForm({ ...addressForm, address: event.target.value })} placeholder="House number, street, barangay and city" /></label>
        <label className="block text-sm font-medium text-slate-700">Area or barangay (optional)<input maxLength={100} className={inputClass} disabled={busy} value={addressForm.zone} onChange={event => setAddressForm({ ...addressForm, zone: event.target.value })} /></label>
        <label className="block text-sm font-medium text-slate-700">Pickup instructions (optional)<textarea maxLength={500} className={inputClass} disabled={busy} value={addressForm.notes} onChange={event => setAddressForm({ ...addressForm, notes: event.target.value })} placeholder="Landmark or where the rider should meet you" /></label>
        <p className="text-sm text-slate-600">Staff will verify the delivery zone for a new or changed location.</p>
        <div className="flex gap-2"><button disabled={busy} className={`${buttonClass} bg-blue-600 text-white`}>{busy ? "Saving…" : "Save address"}</button><button type="button" disabled={busy} className={buttonClass} onClick={() => { setShowAddressForm(false); setError(""); }}>Cancel</button></div>
      </form>}
    </div>}
  </section>;
}
