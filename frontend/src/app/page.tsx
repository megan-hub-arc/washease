"use client";

import Link from "next/link";
import { API_URL } from "@/lib/api";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type LoginResponse = {
  message: string;
  token: string;
  user: {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    role: string;
  };
};

export default function Home() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/login`,
        {
          method: "POST",
          signal: AbortSignal.timeout(15000),
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            login: email.trim(),
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ?? "Email, phone or password is incorrect."
        );
      }

      const loginData = data as LoginResponse;

      localStorage.setItem(
        "washease_token",
        loginData.token
      );

      localStorage.setItem(
        "washease_user",
        JSON.stringify(loginData.user)
      );

      if (
        loginData.user.role === "admin" ||
        loginData.user.role === "staff"
      ) {
        router.push("/dashboard");
        return;
      }

      if (loginData.user.role === "customer") {
        router.push("/customer");
        return;
      }

      setError(
        `The ${loginData.user.role} role does not have a web portal.`
      );

      localStorage.removeItem("washease_token");
      localStorage.removeItem("washease_user");
    } catch (error) {
      if (error instanceof Error) {
        setError(error instanceof TypeError || error.name === "TimeoutError" ? "We could not reach WashEase. Check your connection and try again." : error.message);
      } else {
        setError("Unable to sign in. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-6 py-12">
      <section className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-bold text-white shadow-sm">
            W
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Welcome to WashEase
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Laundry pickup and delivery made simple.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Email or phone number
              </label>

              <input
                id="email"
                type="text"
                autoComplete="username"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="you@example.com or 09123456789"
                required
                disabled={isLoading}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Password
              </label>

              <input
                autoComplete="current-password"
                id="password"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Enter your password"
                required
                disabled={isLoading}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            New to WashEase?{" "}
            <Link href="/register" className="font-semibold text-blue-600 underline hover:text-blue-700">
              Create an account
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          WashEase Laundry Pickup & Delivery Management System
        </p>
      </section>
    </main>
  );
}