"use client";

import WorkspaceIcon, { type IconName } from "@/components/WorkspaceIcon";
import { API_URL } from "@/lib/api";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

type User = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
};

type AdminShellProps = {
  children: ReactNode;
  title: string;
  headerContent?: ReactNode;
};


const navigation: { label: string; href: string; icon: IconName }[] = [
  { label: "Overview", href: "/dashboard", icon: "home" },
  { label: "Orders", href: "/orders", icon: "orders" },
  { label: "Deliveries", href: "/deliveries", icon: "deliveries" },
  { label: "Customers", href: "/customers", icon: "people" },
  { label: "Riders", href: "/riders", icon: "people" },
  { label: "Payments", href: "/payments", icon: "payments" },
  { label: "Reports", href: "/reports", icon: "reports" },
  { label: "Zones", href: "/zones", icon: "zones" },
  { label: "Settings", href: "/settings", icon: "settings" },
];

const pageGuidance: Record<string, { description: string; next: string; href: string }> = {
  "/dashboard": { description: "Review the workload, then open the area that needs attention.", next: "Manage orders", href: "/orders" },
  "/orders": { description: "Confirm bookings, record laundry weight, update progress, and record collected payments.", next: "Plan deliveries", href: "/deliveries" },
  "/deliveries": { description: "Schedule ready orders, assign a rider, depart, and confirm their return.", next: "Check rider availability", href: "/riders" },
  "/customers": { description: "Find customer contact details, saved addresses, and order counts.", next: "Manage customer orders", href: "/orders" },
  "/riders": { description: "Check who is available and update on-duty status. Plan their trips in Deliveries.", next: "Plan a delivery", href: "/deliveries" },
  "/payments": { description: "Review outstanding balances and record confirmed collections.", next: "Review laundry orders", href: "/orders" },
  "/reports": { description: "Review booking activity and collected revenue for a selected period.", next: "View payment records", href: "/payments" },
  "/zones": { description: "Set service areas and assign customer addresses so ready orders can be scheduled.", next: "Schedule deliveries", href: "/deliveries" },
  "/settings": { description: "Manage laundry services, prices, and which services customers can book.", next: "Review orders", href: "/orders" },
};

export default function AdminShell({
  children,
  title,
  headerContent,
}: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [sessionError, setSessionError] = useState("");
  const [sessionRevision, setSessionRevision] = useState(0);
  const [user, setUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("washease_token");
    const storedUser = localStorage.getItem("washease_user");

    if (!token || !storedUser) {
      router.replace("/");
      return;
    }

    let parsedUser: User;

    try {
      parsedUser = JSON.parse(storedUser) as User;
    } catch {
      localStorage.removeItem("washease_token");
      localStorage.removeItem("washease_user");
      router.replace("/");
      return;
    }

    if (parsedUser.role === "customer") {
      router.replace("/customer");
      return;
    }

    if (
      parsedUser.role !== "admin" &&
      parsedUser.role !== "staff"
    ) {
      localStorage.removeItem("washease_token");
      localStorage.removeItem("washease_user");
      router.replace("/");
      return;
    }

    async function validateSession() {
      setSessionError("");
      try {
        const response = await fetch(`${API_URL}/user`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 401) {
          localStorage.removeItem("washease_token");
          localStorage.removeItem("washease_user");
          router.replace("/");
          return;
        }

        if (!response.ok) {
          throw new Error(
            "Unable to validate staff session."
          );
        }

        const authenticatedUser =
          (await response.json()) as User;

        if (authenticatedUser.role === "customer") {
          localStorage.setItem(
            "washease_user",
            JSON.stringify(authenticatedUser)
          );

          router.replace("/customer");
          return;
        }

        if (
          authenticatedUser.role !== "admin" &&
          authenticatedUser.role !== "staff"
        ) {
          localStorage.removeItem("washease_token");
          localStorage.removeItem("washease_user");
          router.replace("/");
          return;
        }

        localStorage.setItem(
          "washease_user",
          JSON.stringify(authenticatedUser)
        );

        setUser(authenticatedUser);
      } catch {
        setSessionError("WashEase could not verify your session. Check the connection and try again. Your saved session has been kept.");
      }
    }

    validateSession();
  }, [router, sessionRevision]);

  async function handleSignOut() {
    const token = localStorage.getItem("washease_token");

    setIsSigningOut(true);

    try {
      if (token) {
        await fetch(`${API_URL}/logout`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch {
      // Remove the local session even if the backend is unavailable.
    } finally {
      localStorage.removeItem("washease_token");
      localStorage.removeItem("washease_user");

      setAccountOpen(false);
      setUser(null);

      router.replace("/");
    }
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
        <div className="max-w-md space-y-4 p-6 text-center"><p role={sessionError ? "alert" : "status"} className="text-sm text-slate-700">{sessionError || "Loading WashEase..."}</p>{sessionError && <button onClick={() => setSessionRevision(value => value + 1)} className="rounded-lg bg-[#0f172a] px-4 py-3 text-white">Retry connection</button>}</div>
      </main>
    );
  }

  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function isActive(href: string) {
    return pathname === href;
  }

  return (
    <div className="staff-workspace min-h-screen laundry-background text-slate-900">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">Skip to page content</a>
      {sidebarOpen && <button type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" />}
      <aside id="staff-navigation" className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <Link href="/dashboard" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 px-6 py-7">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white">W</span>
          <span><strong className="block text-lg tracking-tight">WashEase</strong><span className="text-xs text-slate-500">Laundry pickup & delivery</span></span>
        </Link>
        <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-3">
          {navigation.map(item => <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined} onClick={() => setSidebarOpen(false)} className={`flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-medium transition ${isActive(item.href) ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}><WorkspaceIcon name={item.icon} className="h-5 w-5" />{item.label}</Link>)}
        </nav>
        <div className="space-y-3 border-t border-slate-200 p-5"><p className="text-xs text-slate-500">Signed in as <span className="capitalize">{user.role}</span></p><button type="button" onClick={handleSignOut} disabled={isSigningOut} className="min-h-11 w-full rounded-xl border border-slate-200 px-4 text-left text-sm font-medium hover:bg-slate-50 disabled:opacity-50">{isSigningOut ? "Signing out…" : "Sign out"}</button></div>
      </aside>
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex min-h-20 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-8">
          <div className={`flex items-center gap-3 ${headerContent ? "min-w-0 flex-1 max-w-xl" : ""}`}><button type="button" aria-label="Toggle navigation" aria-controls="staff-navigation" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(open => !open)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 lg:hidden"><WorkspaceIcon name="menu" className="h-5 w-5" /></button>{pathname === "/dashboard" ? <h1 className={headerContent ? "sr-only" : "text-base font-semibold"}>{title}</h1> : <span className="text-base font-semibold" aria-hidden="true">{title}</span>}{headerContent}</div>
          <div className="relative"><button type="button" aria-expanded={accountOpen} aria-controls="staff-account" onClick={() => setAccountOpen(open => !open)} className="flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-slate-50"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold">{initials}</span><span className="hidden text-left sm:block"><strong className="block text-sm">{user.name}</strong><span className="text-xs capitalize text-slate-500">{user.role}</span></span><span aria-hidden="true" className="text-slate-500">⌄</span></button>
            {accountOpen && <div id="staff-account" className="absolute right-0 mt-2 w-72 space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-lg"><p className="font-semibold">{user.name}</p><p className="break-all text-sm text-slate-600">{user.email}</p><p className="text-sm text-slate-600">{user.phone || "No phone recorded"}</p><button type="button" onClick={handleSignOut} disabled={isSigningOut} className="min-h-11 w-full rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{isSigningOut ? "Signing out…" : "Sign out"}</button></div>}
          </div>
        </header>
        <main id="main-content" className="mx-auto max-w-[1440px] p-4 sm:p-8">
          {pathname !== "/dashboard" && pageGuidance[pathname] && <section className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="flex max-w-2xl items-start gap-3">
              <span className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600"><WorkspaceIcon name={navigation.find(item => item.href === pathname)?.icon ?? "home"} className="h-6 w-6" /></span>
              <div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1><p className="mt-2 text-sm leading-6 text-slate-600">{pageGuidance[pathname].description}</p></div>
            </div>
            <Link href={pageGuidance[pathname].href} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50">{pageGuidance[pathname].next} <span aria-hidden="true">→</span></Link>
          </section>}
          {children}
        </main>
      </div>
    </div>
  );
}
