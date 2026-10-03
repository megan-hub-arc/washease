"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    const confirmation = String(form.get("password_confirmation"));
    if (password !== confirmation) { setError("The passwords do not match. Please check both fields."); return; }
    setError(""); setBusy(true);
    try {
      const response = await fetch(`${API_URL}/register`, {
        method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ name: String(form.get("name")).trim(), email: String(form.get("email")).trim(), phone: String(form.get("phone")).trim() || null, password, password_confirmation: confirmation }),
      });
      const data = await response.json();
      if (!response.ok) {
        const messages = data.errors ? Object.values(data.errors).flat().join(" ") : data.message;
        throw new Error(messages || "We could not create your account. Please try again.");
      }
      localStorage.setItem("washease_token", data.token);
      localStorage.setItem("washease_user", JSON.stringify(data.user));
      router.push("/customer");
    } catch (caught) {
      setError(caught instanceof TypeError || (caught instanceof Error && caught.name === "TimeoutError") ? "We could not reach WashEase. Check your connection and try again. Your entries are still here." : caught instanceof Error ? caught.message : "Registration failed. Please try again.");
    } finally { setBusy(false); }
  }

  const inputClass = "w-full rounded-xl border border-slate-300 px-4 py-3 text-base text-slate-900 focus:outline-2 focus:outline-blue-600";
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
    <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-bold text-slate-900">Create your WashEase account</h1>
      <p className="mt-2 text-sm text-slate-600">Book laundry pickup and follow your order. Add your pickup address after signing up.</p>
      <form onSubmit={register} className="mt-6 space-y-4" aria-busy={busy}>
        <fieldset disabled={busy} className="space-y-4 disabled:opacity-70">
          <div><label htmlFor="name" className="mb-1 block text-sm font-medium">Full name</label><input id="name" name="name" required maxLength={255} autoComplete="name" className={inputClass} /></div>
          <div><label htmlFor="register-email" className="mb-1 block text-sm font-medium">Email address</label><input id="register-email" name="email" type="email" required maxLength={255} autoComplete="email" className={inputClass} /></div>
          <div><label htmlFor="phone" className="mb-1 block text-sm font-medium">Phone number (optional)</label><input id="phone" name="phone" type="tel" maxLength={20} autoComplete="tel" className={inputClass} /><p className="mt-1 text-xs text-slate-600">Use your own number so the shop can contact you.</p></div>
          <div><label htmlFor="new-password" className="mb-1 block text-sm font-medium">Password</label><input id="new-password" name="password" type={showPassword ? "text" : "password"} required minLength={8} autoComplete="new-password" aria-describedby="password-help" className={inputClass} /><p id="password-help" className="mt-1 text-xs text-slate-600">Use at least 8 characters.</p></div>
          <div><label htmlFor="confirm-password" className="mb-1 block text-sm font-medium">Confirm password</label><input id="confirm-password" name="password_confirmation" type={showPassword ? "text" : "password"} required minLength={8} autoComplete="new-password" className={inputClass} /></div>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={showPassword} onChange={event => setShowPassword(event.target.checked)} />Show passwords</label>
        </fieldset>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <button disabled={busy} type="submit" className="min-h-11 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60">{busy ? "Creating account…" : "Create account"}</button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-600">Already registered? <Link href="/" className="font-semibold text-blue-700 underline">Sign in</Link></p>
    </section>
  </main>;
}
