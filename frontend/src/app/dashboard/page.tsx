"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("washease_token");
    const storedUser = localStorage.getItem("washease_user");

    if (!token || !storedUser) {
      router.replace("/");
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser) as User;

      if (
        parsedUser.role !== "admin" &&
        parsedUser.role !== "staff"
      ) {
        router.replace("/");
        return;
      }

      setUser(parsedUser);
    } catch {
      localStorage.removeItem("washease_token");
      localStorage.removeItem("washease_user");
      router.replace("/");
    }
  }, [router]);

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">
          Loading WashEase...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-blue-600">
            WashEase
          </p>

          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Admin Dashboard
          </h1>

          <p className="mt-3 text-slate-500">
            Signed in as {user.name}
          </p>

          <div className="mt-8 rounded-xl bg-green-50 p-5">
            <p className="font-semibold text-green-800">
              Authentication successful.
            </p>

            <p className="mt-1 text-sm text-green-700">
              The real admin interface will be built here next.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}